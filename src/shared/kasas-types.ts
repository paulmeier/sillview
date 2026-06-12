/**
 * TypeScript mirrors of the kasas HTTP API DTOs.
 *
 * Source of truth: kasas/internal/api/dto.go. A few conventions matter and are
 * easy to get wrong, so they are called out here:
 *
 *  - MONEY (`amount`, `balance`) is a *signed decimal string in major units*,
 *    e.g. "1234.56" or "-12.34". It is NOT cents and NOT a float. Scale varies
 *    by currency (2 for USD, 8 for BTC, up to 18 for ETH). Never round to 2dp
 *    and never store it as a JS number. Format via renderer/lib/money.ts.
 *  - TIMESTAMPS are RFC3339/ISO-8601 strings (Go marshals time.Time that way),
 *    so `new Date(value)` parses them directly.
 *  - `labels` is a flat key -> value string map (a vocabulary inlined per txn).
 *  - List endpoints wrap their array under a named key (see the *Response types).
 */

export interface Organization {
  id: string;
  domain: string;
  name: string;
  sfin_url: string;
}

export interface Account {
  id: string;
  org_id: string;
  name: string;
  /** ISO-4217 code for fiat, or a token symbol (BTC, ETH, …) for crypto. */
  currency: string;
  /** Signed decimal string in major units — see file header. */
  balance: string;
  /** ISO-8601 timestamp the balance was observed. */
  balance_date: string;
  /** ISO-8601 timestamp of the last sync that touched this account. */
  synced_at: string;
  /** "simplefin" for synced rows, "manual" for user-created (editable) rows. */
  source: string;
}

/** One outbound edge inlined on a transaction ({kind, target id}). */
export interface Relationship {
  kind: string;
  target: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  /** Signed decimal string in major units (negative = outflow). */
  amount: string;
  pending: boolean;
  /** ISO-8601 transaction date. */
  date: string;
  description: string;
  payee: string;
  memo: string;
  synced_at: string;
  source: string;
  labels: Record<string, string>;
  extensions: Record<string, unknown>;
  relationships: Relationship[];
}

export interface Label {
  key: string;
  value: string;
  transaction_count: number;
}

export interface SyncLog {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: string;
  error?: string;
}

export interface AuthStatus {
  auth_required: boolean;
  authenticated: boolean;
}

// --- Collection envelopes (kasas wraps arrays under a named key) ------------

export interface OrganizationsResponse {
  organizations: Organization[];
}
export interface AccountsResponse {
  accounts: Account[];
}
export interface TransactionsResponse {
  transactions: Transaction[];
}
export interface SearchResponse {
  query: string;
  total: number;
  transactions: Transaction[];
}
export interface LabelsResponse {
  labels: Label[];
}
export interface SyncStatusResponse {
  latest: SyncLog | null;
}

/** Create/update body for a manual transaction (kasas transactionInput). */
export interface TransactionInput {
  account_id: string;
  /** Signed decimal string in major units — never a number. */
  amount: string;
  /** YYYY-MM-DD, RFC3339, or unix seconds. */
  date: string;
  description?: string;
  payee?: string;
  memo?: string;
  pending?: boolean;
}

/** Create/update body for a manual account (kasas accountInput). */
export interface AccountInput {
  name: string;
  currency: string;
  /** Signed decimal string in major units; defaults to "0" on create. */
  balance?: string;
  balance_date?: string;
}

/** Query params accepted by the transaction list/search endpoints. */
export interface TransactionQuery {
  account_id?: string;
  limit?: number;
  offset?: number;
  /** ISO date or unix seconds accepted by kasas `since`/`until`. */
  since?: string;
  until?: string;
  label_key?: string;
  label_value?: string;
}

/** A change event delivered over /api/v1/events/stream (shape is loose). */
export interface KasasEvent {
  sequence?: number;
  type: string;
  /** Event-specific payload; varies by `type`. */
  data?: unknown;
  [key: string]: unknown;
}

// --- Settings (runtime-editable config) -------------------------------------
// Source of truth: kasas internal/settings/service.go (Status) + settings.go (Kind).

/** Tells the editor which control to render and how the string value parses. */
export type SettingKind = 'bool' | 'int' | 'string' | 'duration' | 'json';

/** One editable setting with its effective value + override/restart state. */
export interface SettingStatus {
  key: string;
  title: string;
  help?: string;
  kind: SettingKind;
  /** Secret values are never echoed back; `value` is empty when secret. */
  secret?: boolean;
  /** Owning ingestion source ("plaid", "csv", …); empty for app settings. */
  source?: string;
  /** Settings-page grouping for app settings (empty for per-source settings). */
  section?: string;
  /** Allowed values, rendered as a select. */
  enum?: string[];
  value: string;
  /** A stored override exists. */
  set: boolean;
  /** The stored value differs from the config-file/env base. */
  overridden: boolean;
  /** The change won't take effect until kasas restarts. */
  restart_required: boolean;
}

export interface SettingsListResponse {
  enabled: boolean;
  restart_required: boolean;
  settings: SettingStatus[];
}

export interface SetSettingResponse {
  setting: SettingStatus;
  restart_required: boolean;
}

// --- Ingestion sources -------------------------------------------------------
// Source of truth: kasas internal/poller/engine.go (SourceStatus) +
// internal/api/sources.go (SourceDTO) + internal/source/source.go (fields).

/** A credential field a source accepts when pasting a single credential. */
export interface CredentialField {
  key: string;
  title: string;
  help?: string;
}

/** One masked, individually-removable credential of a multi-credential source. */
export interface CredentialEntry {
  id: string;
  /** Masked display label (e.g. "••••cd34"). */
  label: string;
  removable: boolean;
}

export interface SourceDTO {
  type: string;
  archetype: string;
  title: string;
  /** Ready to sync (no credential needed, or one is stored). */
  connected: boolean;
  /** Accepts a pasted credential. */
  credentialed: boolean;
  /** Holds several credentials (add/remove individually). */
  multi_credential: boolean;
  /** Supports the browser OAuth connect flow. */
  oauth: boolean;
  /** External hosts this source contacts (e.g. a market provider's API host). */
  egress?: string[];
  credentials?: CredentialField[];
  credential_entries?: CredentialEntry[];
  /** False = registered but not built this run (its activating config is missing). */
  active: boolean;
  /** Editable, persisted per-source settings (rendered like app settings). */
  config?: SettingStatus[];
}

export interface SourcesListResponse {
  enabled: boolean;
  restart_required: boolean;
  sources: SourceDTO[];
}

export interface SyncHistoryResponse {
  history: SyncLog[];
}

// --- Effective configuration (read-only bootstrap view) ----------------------
// Source of truth: kasas internal/api/config.go (ConfigDTO). Secrets redacted.

export interface ConfigDTO {
  server: { addr: string };
  log: { level: string; format: string };
  database: { driver: string; path: string; dsn: string };
  simplefin: { connected: boolean };
  sync: { enabled: boolean; interval: string; lookback_days: number; run_on_start: boolean };
  vault: {
    enabled: boolean;
    address: string;
    mount: string;
    path: string;
    access_url_key: string;
    token_set: boolean;
  };
  secrets: { file: string };
  mcp: { enabled: boolean };
  dashboard: { enabled: boolean };
  update: { check: boolean; allow_apply: boolean; repository: string };
  events: { enabled: boolean; retention_days: number; history_retention_days: number };
  webhooks: { enabled: boolean; timeout: string; max_attempts: number };
  security: { auth_required: boolean; token_source: string };
}

// --- Transaction detail: history, provenance, relationships ------------------
// Source of truth: kasas internal/api/{transaction_history,provenance,relationships}.go.

export interface LabelChange {
  from: string;
  to: string;
}

export interface VersionDiff {
  fields: { field: string; from?: string; to?: string; before?: string; after?: string }[];
  labels_added: Record<string, string>;
  labels_removed: Record<string, string>;
  labels_changed: Record<string, LabelChange>;
  extensions_added: Record<string, string>;
  extensions_removed: Record<string, string>;
  extensions_changed: Record<string, LabelChange>;
}

export interface TransactionVersion {
  version: number;
  change_kind: string;
  occurred_at: string;
  /** The transaction snapshot at this version (shape ~ Transaction). */
  transaction: Record<string, unknown>;
  diff: VersionDiff;
}

export interface TransactionHistory {
  transaction_id: string;
  versions: TransactionVersion[];
}

export interface Provenance {
  transaction_id: string;
  source: string;
  source_transaction_id: string;
  account_id: string;
  institution?: string;
  imported_at: string;
  last_seen: string;
  transformations: { kind: string; occurred_at: string; summary: string }[];
}

/** One edge in a transaction's relationship neighborhood (outbound + inbound). */
export interface RelationshipEdge {
  kind: string;
  target: string;
  /** "outbound" | "inbound" when kasas reports direction. */
  direction?: string;
}

export interface RelationshipsResponse {
  id: string;
  relationships: RelationshipEdge[];
}

export interface RelationshipKind {
  kind: string;
  count: number;
}

// --- Event stream rows -------------------------------------------------------

export interface KasasEventRow {
  sequence: number;
  event_id: string;
  type: string;
  entity_type: string;
  entity_id: string;
  occurred_at: string;
  data: unknown;
}

export interface EventsResponse {
  events: KasasEventRow[];
  next: number;
}

// --- Rules -------------------------------------------------------------------

export interface Rule {
  id: number;
  name: string;
  query: string;
  labels: Record<string, string>;
  extensions: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleInput {
  name: string;
  query: string;
  labels: Record<string, string>;
  extensions?: Record<string, unknown>;
  enabled?: boolean;
}

export interface RuleRunResult {
  matched: number;
  updated: number;
}

// --- Webhooks ----------------------------------------------------------------

export interface Webhook {
  id: number;
  url: string;
  event_types: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_status: number;
  last_error?: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  /** Present only in create/get/update/rotate responses, never in list. */
  secret?: string;
}

export interface WebhookInput {
  url: string;
  event_types: string[];
  enabled?: boolean;
}

export interface WebhookTestResult {
  status: number;
  delivered: boolean;
  error?: string;
}

// --- Security: dashboard token + API keys ------------------------------------

export interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  scope: string;
  created_at: string;
  last_used_at: string | null;
  /** Full key, returned only once on creation. */
  key?: string;
}

export interface ApiKeyInput {
  name: string;
  scope: string;
}

export interface TokenResponse {
  /** The token, returned once when generated/set. */
  token?: string;
  auth_required: boolean;
  token_source: string;
}

// --- Plugins -----------------------------------------------------------------
// Source of truth: kasas internal/api/plugins.go (PluginDTO) + marketplace.go.

export interface Plugin {
  id: number;
  name: string;
  runtime: string;
  version?: string;
  description?: string;
  enabled: boolean;
  loaded: boolean;
  on_disk: boolean;
  /** loaded | disabled | error | missing */
  state: string;
  hooks: string[];
  capabilities: string[];
  granted_capabilities: string[];
  /** Manifest-declared egress allowlist (net:fetch). */
  net_allow?: string[];
  /** Subset of net_allow the operator granted private/LAN access to. */
  net_grants?: string[];
  last_status: number;
  last_error?: string;
  last_run_at: string | null;
  last_success_at: string | null;
}

export interface PluginsResponse {
  /** false when the plugin system is disabled (plugins.enabled/events.enabled). */
  enabled: boolean;
  plugins: Plugin[];
}

export interface EgressEntry {
  time: string;
  method: string;
  host: string;
  url: string;
  status: number;
  bytes: number;
  duration_ms: number;
  error?: string;
}

export interface EgressResponse {
  enabled: boolean;
  entries: EgressEntry[];
}

export interface UninstallResult {
  name: string;
  uninstalled: boolean;
  hook_ran: boolean;
  hook_error?: string;
}

export interface RegistryPlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage: string;
  runtime: string;
  hooks: string[];
  capabilities: string[];
  capability_tier: string;
  /** Trust tier, e.g. "verified" | "connected". */
  tier: string;
  ui?: { title: string; icon: string };
  net?: { allow: string[] };
  installed: boolean;
  installed_version?: string;
  update_available: boolean;
}

export interface RegistryResponse {
  /** false when the registry/marketplace is disabled or unreachable. */
  available: boolean;
  plugins: RegistryPlugin[];
}

// --- Plugin pages (server-rendered declarative UI) ---------------------------
// Source of truth: kasas internal/plugins/pagedoc.go + internal/api/plugins_pages.go.
// The server validates/normalizes every block, so this renderer can be thin.

export interface PluginPageInfo {
  name: string;
  title: string;
  icon: string;
}

export interface PageField {
  name: string;
  label: string;
  /** text (default) | number | toggle | select */
  kind?: string;
  value?: string;
  placeholder?: string;
  help?: string;
  options?: string[];
}

export interface PageKV {
  key: string;
  value: string;
}

export interface PageAction {
  id: string;
  label: string;
  /** "" | primary | danger */
  style?: string;
  params?: Record<string, string>;
}

export interface PageBlock {
  /** heading | text | stat | keyvalue | table | actions | form | divider */
  type: string;
  text?: string;
  label?: string;
  value?: string;
  hint?: string;
  items?: PageKV[];
  columns?: string[];
  rows?: string[][];
  actions?: PageAction[];
  /** Form id (Type === "form"); the action dispatched on submit. */
  id?: string;
  fields?: PageField[];
  submit_label?: string;
}

export interface PluginPageDoc {
  title?: string;
  blocks: PageBlock[];
}

export interface PluginPagesResponse {
  pages: PluginPageInfo[];
}

export interface PluginPageResponse {
  name: string;
  page: PluginPageDoc;
}

// --- Self-update status (external mode, read-only) ---------------------------
// kasas internal/api/update.go. Bundled-mode updates are sillview-owned (updater.ts).

export interface KasasUpdateStatus {
  current: string;
  latest: string;
  update_available: boolean;
  release_url: string;
  checked_at: string;
  can_apply: boolean;
}

// --- Market / reference data (ADR 0006 / sillview ADR-0004) ------------------
// kasas internal/api/market.go (MarketSeriesDTO, MarketPointDTO). Values are
// decimal STRINGS (a price is money per unit). Daily-close granularity.

export type MarketKind = 'equity' | 'fund' | 'index' | 'fx' | 'crypto';

export interface MarketSeries {
  id: string;
  symbol: string;
  kind: MarketKind | string;
  currency: string;
  adjusted: boolean;
  name?: string;
  provider: string;
  /** Newest cached close date, or "" if never fetched. */
  as_of?: string;
  /** Cached point count. */
  points: number;
  /** Unix seconds of the last refresh. */
  fetched_at?: number;
  /** Cache is within the provider TTL. */
  fresh: boolean;
}

export interface MarketPoint {
  date: string;
  value: string;
}

export interface MarketSeriesResponse {
  enabled: boolean;
  provider: string;
  configured: boolean;
  series: MarketSeries[];
}

export interface MarketPointsResponse {
  enabled?: boolean;
  provider: string;
  as_of: string;
  fresh: boolean;
  points: MarketPoint[];
}

/** Body to define a series (admin). */
export interface MarketSeriesInput {
  id: string;
  symbol: string;
  kind: MarketKind;
  currency: string;
  adjusted?: boolean;
  name?: string;
}
