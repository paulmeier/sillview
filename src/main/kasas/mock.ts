/**
 * In-memory kasas fixtures for offline UI development.
 *
 * Enabled with `KASAS_MOCK=1` (see `npm run start:mock`). When the flag is set,
 * the main process answers every brokered REST call from these fixtures instead
 * of fetching kasas, skips spawning the managed binary, and feeds the SSE stream
 * synthetic events. Nothing here runs in a normal launch - the flag is off by
 * default, so production behaviour is untouched.
 *
 * Shapes mirror `src/shared/kasas-types.ts`. Money is a signed decimal STRING in
 * major units (never a number); timestamps are ISO-8601 and generated relative
 * to "now" so the six-month cash-flow and recent-transaction windows always have
 * data, however stale this file gets.
 */

import type { KasasRequest, KasasResult } from '../../shared/ipc';
import type {
  Account,
  AccountInput,
  ApiKey,
  ApiKeyInput,
  AuthStatus,
  ConfigDTO,
  CredentialEntry,
  CredentialField,
  KasasEvent,
  Label,
  KasasEventRow,
  Organization,
  PageBlock,
  Plugin,
  PluginPageDoc,
  RegistryPlugin,
  RelationshipEdge,
  Rule,
  RuleInput,
  SettingKind,
  SettingStatus,
  SourceDTO,
  SyncLog,
  Transaction,
  TransactionInput,
  Webhook,
  WebhookInput,
} from '../../shared/kasas-types';

/** True when sillview should serve fixtures instead of talking to a real kasas. */
export const MOCK = process.env.KASAS_MOCK === '1' || process.env.KASAS_MOCK === 'true';

const DAY = 86_400_000;
const now = Date.now();
const iso = (ms: number): string => new Date(ms).toISOString();

/** Deterministic PRNG (mulberry32) so the dataset is identical run to run. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x51117133);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (min: number, max: number): number => min + rand() * (max - min);
const usd = (n: number): string => n.toFixed(2);

// --- Organizations & accounts -----------------------------------------------

const organizations: Organization[] = [
  {
    id: 'org_fnb',
    domain: 'firstnational.example',
    name: 'First National Bank',
    sfin_url: 'https://sfin.example/fnb',
  },
  {
    id: 'org_vgd',
    domain: 'vanguard.example',
    name: 'Vanguard',
    sfin_url: 'https://sfin.example/vgd',
  },
];

function account(
  id: string,
  org_id: string,
  name: string,
  currency: string,
  balance: string,
  source = 'simplefin',
): Account {
  return {
    id,
    org_id,
    name,
    currency,
    balance,
    balance_date: iso(now - 2 * 3600_000),
    synced_at: iso(now - 5 * 60_000),
    source,
  };
}

const accounts: Account[] = [
  account('acc_checking', 'org_fnb', 'Everyday Checking', 'USD', '4821.55'),
  account('acc_savings', 'org_fnb', 'High-Yield Savings', 'USD', '21450.00'),
  account('acc_credit', 'org_fnb', 'Travel Rewards Card', 'USD', '-1284.30'),
  account('acc_brokerage', 'org_vgd', 'Brokerage', 'USD', '58230.12'),
  account('acc_btc', 'org_vgd', 'Bitcoin Wallet', 'BTC', '0.42815000', 'manual'),
];

const SPENDABLE = ['acc_checking', 'acc_credit'] as const;

// --- Transactions (generated over the last ~180 days) -----------------------

interface Cat {
  label: string;
  payees: readonly string[];
  min: number; // most negative (largest outflow)
  max: number; // least negative
}

const DISCRETIONARY: readonly Cat[] = [
  { label: 'groceries', payees: ['Whole Foods', "Trader Joe's", 'Safeway'], min: -185, max: -28 },
  { label: 'dining', payees: ['Chipotle', 'Blue Bottle', 'Tartine', 'Local Diner'], min: -62, max: -8 },
  { label: 'transport', payees: ['Shell', 'Uber', 'BART', 'Chevron'], min: -74, max: -3 },
  { label: 'shopping', payees: ['Amazon', 'Target', 'REI', 'Apple'], min: -224, max: -12 },
  { label: 'entertainment', payees: ['AMC Theatres', 'Steam', 'Ticketmaster'], min: -120, max: -9 },
];

let txnSeq = 0;
const transactions: Transaction[] = [];

function addTxn(
  account_id: string,
  amount: number,
  date: number,
  payee: string,
  category: string,
  opts: { description?: string; pending?: boolean; source?: string; scale?: number } = {},
): void {
  // Recurring charges can land a few days into the current month - never emit a
  // transaction dated in the future.
  if (date > now) return;
  txnSeq += 1;
  const value = (opts.scale ?? 2) === 8 ? amount.toFixed(8) : usd(amount);
  transactions.push({
    id: `txn_${String(txnSeq).padStart(4, '0')}`,
    account_id,
    amount: value,
    pending: opts.pending ?? false,
    date: iso(date),
    description: opts.description ?? payee,
    payee,
    memo: '',
    synced_at: iso(now - 5 * 60_000),
    source: opts.source ?? 'simplefin',
    labels: { category },
    extensions: {},
    relationships: [],
  });
}

// Day-by-day discretionary spend on the checking card / credit card.
for (let d = 180; d >= 0; d--) {
  const at = now - d * DAY;
  const count = rand() < 0.55 ? (rand() < 0.4 ? 2 : 1) : 0;
  for (let i = 0; i < count; i++) {
    const cat = pick(DISCRETIONARY);
    const jitter = Math.floor(between(0, 16 * 3600_000)); // sometime during the day
    addTxn(pick(SPENDABLE), between(cat.min, cat.max), at - jitter, pick(cat.payees), cat.label, {
      pending: d <= 1 && rand() < 0.5,
    });
  }
}

// Recurring monthly: rent, utilities, two subscriptions.
for (let m = 6; m >= 0; m--) {
  const base = now - m * 30 * DAY;
  addTxn('acc_checking', -2200, base + 1 * DAY, 'Bayview Property Mgmt', 'housing', {
    description: 'Monthly rent',
  });
  addTxn('acc_checking', -between(90, 160), base + 5 * DAY, 'PG&E', 'utilities');
  addTxn('acc_credit', -15.99, base + 9 * DAY, 'Netflix', 'subscriptions');
  addTxn('acc_credit', -11.99, base + 12 * DAY, 'Spotify', 'subscriptions');
}

// Biweekly payroll into checking (positive inflow).
for (let p = now; p > now - 190 * DAY; p -= 14 * DAY) {
  addTxn('acc_checking', 4187.34, p, 'Initech Payroll', 'income', { description: 'Direct deposit - payroll' });
}

// A few crypto buys to exercise 8-dp money formatting.
for (let k = 0; k < 4; k++) {
  addTxn('acc_btc', between(-0.015, -0.004), now - (20 + k * 35) * DAY, 'Coinbase', 'investing', {
    description: 'BTC purchase',
    scale: 8,
    source: 'manual',
  });
}

/** Newest first - built fresh per query so mutations are reflected. */
function sortedTxns(): Transaction[] {
  return [...transactions].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

// --- Labels (the live vocabulary, recomputed from current transactions) ------

function computeLabels(): Label[] {
  // key -> value -> count (nested so label values may contain any character)
  const counts = new Map<string, Map<string, number>>();
  for (const t of transactions) {
    for (const [k, v] of Object.entries(t.labels ?? {})) {
      let inner = counts.get(k);
      if (!inner) {
        inner = new Map();
        counts.set(k, inner);
      }
      inner.set(v, (inner.get(v) ?? 0) + 1);
    }
  }
  const out: Label[] = [];
  for (const [key, inner] of counts) {
    for (const [value, transaction_count] of inner) out.push({ key, value, transaction_count });
  }
  return out.sort((a, b) => (a.key !== b.key ? a.key.localeCompare(b.key) : a.value.localeCompare(b.value)));
}

// --- Singletons -------------------------------------------------------------

const authStatus: AuthStatus = { auth_required: false, authenticated: true };

const syncLog: SyncLog = {
  id: 42,
  started_at: iso(now - 6 * 60_000),
  completed_at: iso(now - 5 * 60_000),
  status: 'completed',
};

// --- Request routing --------------------------------------------------------

type Query = KasasRequest['query'];

function parseWhen(v: string | number | boolean | undefined): number | null {
  if (v === undefined) return null;
  const s = String(v);
  if (/^\d+$/.test(s)) return Number(s) * 1000; // kasas also accepts unix seconds
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}

function applyWindow(list: Transaction[], q?: Query): Transaction[] {
  const offset = Number(q?.offset ?? 0) || 0;
  const limit = q?.limit !== undefined ? Number(q.limit) : list.length;
  return list.slice(offset, offset + (Number.isFinite(limit) ? limit : list.length));
}

function queryTxns(q?: Query): Transaction[] {
  let list = sortedTxns();
  if (q?.account_id) list = list.filter((t) => t.account_id === String(q.account_id));
  const since = parseWhen(q?.since);
  if (since !== null) list = list.filter((t) => Date.parse(t.date) >= since);
  const until = parseWhen(q?.until);
  if (until !== null) list = list.filter((t) => Date.parse(t.date) <= until);
  if (q?.label_key) {
    const key = String(q.label_key);
    const val = q.label_value !== undefined ? String(q.label_value) : undefined;
    list = list.filter((t) => t.labels[key] !== undefined && (val === undefined || t.labels[key] === val));
  }
  return applyWindow(list, q);
}

// --- Settings (runtime-editable config) -------------------------------------
// Mirrors kasas internal/settings/settings.go. App settings have a section and
// no source; per-source settings have a source and no section. Overrides are
// kept in-memory so PUT/DELETE persist for the session.

interface MockSettingDef {
  key: string;
  title: string;
  help?: string;
  kind: SettingKind;
  section?: string;
  source?: string;
  enum?: string[];
  secret?: boolean;
  base: string;
}

const SETTING_DEFS: MockSettingDef[] = [
  // Logging
  { key: 'log.level', title: 'Log level', kind: 'string', section: 'Logging', enum: ['debug', 'info', 'warn', 'error'], base: 'info', help: 'Minimum level kasas logs at.' },
  { key: 'log.format', title: 'Log format', kind: 'string', section: 'Logging', enum: ['json', 'text'], base: 'json', help: 'Structured JSON logs, or human-readable text.' },
  // Sync
  { key: 'sync.enabled', title: 'Background sync', kind: 'bool', section: 'Sync', base: 'true', help: 'Run the recurring sync schedule.' },
  { key: 'sync.interval', title: 'Interval', kind: 'duration', section: 'Sync', base: '6h', help: 'How often every source is synced, e.g. 6h or 30m.' },
  { key: 'sync.lookback_days', title: 'Lookback days', kind: 'int', section: 'Sync', base: '0', help: '0 means everything available.' },
  { key: 'sync.run_on_start', title: 'Sync on startup', kind: 'bool', section: 'Sync', base: 'false', help: 'Trigger a sync immediately when kasas starts.' },
  // MCP
  { key: 'mcp.enabled', title: 'MCP server', kind: 'bool', section: 'MCP server', base: 'false', help: 'Serve the Model Context Protocol server at /mcp.' },
  // Dashboard
  { key: 'dashboard.enabled', title: 'Dashboard', kind: 'bool', section: 'Dashboard', base: 'true', help: 'Serve the built-in web dashboard. sillview replaces it.' },
  // Events & history
  { key: 'events.enabled', title: 'Event stream', kind: 'bool', section: 'Events & history', base: 'true', help: 'Record every change as an immutable event.' },
  { key: 'events.retention_days', title: 'Event retention (days)', kind: 'int', section: 'Events & history', base: '0', help: '0 keeps them forever.' },
  { key: 'events.history_retention_days', title: 'History retention (days)', kind: 'int', section: 'Events & history', base: '0', help: '0 keeps full history forever.' },
  // Webhooks
  { key: 'webhooks.enabled', title: 'Webhook delivery', kind: 'bool', section: 'Webhooks', base: 'true', help: 'Deliver committed events to registered endpoints.' },
  { key: 'webhooks.timeout', title: 'Delivery timeout', kind: 'duration', section: 'Webhooks', base: '10s' },
  { key: 'webhooks.max_attempts', title: 'Max attempts', kind: 'int', section: 'Webhooks', base: '5' },
  // Plugins
  { key: 'plugins.enabled', title: 'Plugin system', kind: 'bool', section: 'Plugins', base: 'true', help: 'Load and run sandboxed plugins reacting to events.' },
  { key: 'plugins.dir', title: 'Plugins directory', kind: 'string', section: 'Plugins', base: '/Users/you/Library/Application Support/sillview/kasas/plugins' },
  { key: 'plugins.hook_timeout', title: 'Hook timeout', kind: 'duration', section: 'Plugins', base: '5s' },
  { key: 'plugins.queue_size', title: 'Queue size', kind: 'int', section: 'Plugins', base: '64' },
  { key: 'plugins.registry.enabled', title: 'Marketplace', kind: 'bool', section: 'Plugins', base: 'true', help: 'Browse and install community plugins from the registry.' },
  { key: 'plugins.registry.url', title: 'Registry URL', kind: 'string', section: 'Plugins', base: 'https://raw.githubusercontent.com/paulmeier/kasas-plugins/main/index.json' },
  { key: 'plugins.registry.ref', title: 'Registry ref', kind: 'string', section: 'Plugins', base: 'main' },
  { key: 'plugins.net.timeout', title: 'Network timeout', kind: 'duration', section: 'Plugins', base: '10s' },
  { key: 'plugins.net.max_response_bytes', title: 'Network response cap', kind: 'int', section: 'Plugins', base: '1048576' },
  { key: 'plugins.net.rate_per_minute', title: 'Network rate limit', kind: 'int', section: 'Plugins', base: '60' },
  { key: 'plugins.net.max_redirects', title: 'Network max redirects', kind: 'int', section: 'Plugins', base: '3' },
  // Updates
  { key: 'update.check', title: 'Check for updates', kind: 'bool', section: 'Updates', base: 'false' },
  { key: 'update.allow_apply', title: 'Allow in-place update', kind: 'bool', section: 'Updates', base: 'false' },
  { key: 'update.repository', title: 'Repository', kind: 'string', section: 'Updates', base: 'paulmeier/kasas' },
  // Per-source (surfaced on the Sources page, not the app-settings editor)
  { key: 'csv.folders', title: 'CSV folders', kind: 'json', source: 'csv', base: '[]' },
  { key: 'csv.gdrive_client_id', title: 'Google OAuth client ID', kind: 'string', source: 'csv', base: '' },
  { key: 'csv.gdrive_client_secret', title: 'Google OAuth client secret', kind: 'string', source: 'csv', secret: true, base: '' },
  { key: 'csv.gdrive_redirect_url', title: 'OAuth redirect URL', kind: 'string', source: 'csv', base: '' },
  { key: 'teller.certificate', title: 'Client certificate', kind: 'string', source: 'teller', base: '' },
  { key: 'teller.private_key', title: 'Client private key', kind: 'string', source: 'teller', base: '' },
  { key: 'plaid.client_id', title: 'Client ID', kind: 'string', source: 'plaid', base: '' },
  { key: 'plaid.secret', title: 'Secret', kind: 'string', source: 'plaid', secret: true, base: '' },
  { key: 'plaid.environment', title: 'Environment', kind: 'string', source: 'plaid', enum: ['sandbox', 'development', 'production'], base: 'sandbox' },
  { key: 'bitcoin.api_url', title: 'API URL', kind: 'string', source: 'bitcoin', base: 'https://mempool.space/api' },
  { key: 'ethereum.api_key', title: 'Etherscan API key', kind: 'string', source: 'ethereum', secret: true, base: '' },
  { key: 'ethereum.api_url', title: 'API URL', kind: 'string', source: 'ethereum', base: 'https://api.etherscan.io/v2/api' },
  { key: 'ethereum.chain_id', title: 'Chain ID', kind: 'int', source: 'ethereum', base: '1' },
];

const settingOverrides = new Map<string, string>();

function settingStatus(def: MockSettingDef): SettingStatus {
  const override = settingOverrides.get(def.key);
  const set = override !== undefined;
  const value = def.secret ? '' : set ? override : def.base;
  return {
    key: def.key,
    title: def.title,
    help: def.help,
    kind: def.kind,
    secret: def.secret,
    source: def.source,
    section: def.section,
    enum: def.enum,
    value,
    set,
    overridden: set,
    restart_required: set,
  };
}

function effectiveSetting(key: string): string {
  const def = SETTING_DEFS.find((d) => d.key === key);
  if (!def) return '';
  return settingOverrides.get(key) ?? def.base;
}

function mockConfig(): ConfigDTO {
  const b = (k: string) => effectiveSetting(k) === 'true';
  const n = (k: string) => Number(effectiveSetting(k)) || 0;
  return {
    server: { addr: '127.0.0.1:8080' },
    log: { level: effectiveSetting('log.level'), format: effectiveSetting('log.format') },
    database: { driver: 'sqlite', path: '/Users/you/Library/Application Support/sillview/kasas/kasas.db', dsn: '' },
    simplefin: { connected: true },
    sync: {
      enabled: b('sync.enabled'),
      interval: effectiveSetting('sync.interval'),
      lookback_days: n('sync.lookback_days'),
      run_on_start: b('sync.run_on_start'),
    },
    vault: { enabled: false, address: '', mount: '', path: '', access_url_key: '', token_set: false },
    secrets: { file: '/Users/you/Library/Application Support/sillview/kasas/secrets.json' },
    mcp: { enabled: b('mcp.enabled') },
    dashboard: { enabled: b('dashboard.enabled') },
    update: { check: b('update.check'), allow_apply: b('update.allow_apply'), repository: effectiveSetting('update.repository') },
    events: {
      enabled: b('events.enabled'),
      retention_days: n('events.retention_days'),
      history_retention_days: n('events.history_retention_days'),
    },
    webhooks: {
      enabled: b('webhooks.enabled'),
      timeout: effectiveSetting('webhooks.timeout'),
      max_attempts: n('webhooks.max_attempts'),
    },
    security: { auth_required: mockSecurity.auth_required, token_source: mockSecurity.token_source },
  };
}

// --- Sources & sync ---------------------------------------------------------

interface MockSourceDef {
  type: string;
  archetype: string;
  title: string;
  credentialed: boolean;
  multi: boolean;
  oauth: boolean;
  credentials: CredentialField[];
  egress?: string[];
}

const SOURCE_DEFS: MockSourceDef[] = [
  { type: 'simplefin', archetype: 'pull', title: 'SimpleFIN', credentialed: true, multi: false, oauth: false, credentials: [{ key: 'token', title: 'Setup token', help: 'Paste a SimpleFIN setup token or access URL.' }] },
  { type: 'plaid', archetype: 'pull', title: 'Plaid', credentialed: true, multi: true, oauth: false, credentials: [{ key: 'token', title: 'Public token' }] },
  { type: 'teller', archetype: 'pull', title: 'Teller', credentialed: true, multi: true, oauth: false, credentials: [{ key: 'token', title: 'Access token' }] },
  { type: 'bitcoin', archetype: 'pull', title: 'Bitcoin', credentialed: true, multi: true, oauth: false, credentials: [{ key: 'address', title: 'Watch address' }] },
  { type: 'ethereum', archetype: 'pull', title: 'Ethereum', credentialed: true, multi: true, oauth: false, credentials: [{ key: 'address', title: 'Watch address' }] },
  { type: 'csv', archetype: 'file', title: 'CSV import', credentialed: false, multi: false, oauth: true, credentials: [] },
  { type: 'market', archetype: 'reference', title: 'Market data', credentialed: true, multi: false, oauth: false, credentials: [{ key: 'api_key', title: 'API key', help: 'A free Alpha Vantage key works — alphavantage.co/support/#api-key' }], egress: ['www.alphavantage.co'] },
];

const sourceConnected = new Set<string>(['simplefin', 'market']);
const sourceEntries = new Map<string, CredentialEntry[]>([
  ['bitcoin', [{ id: 'btc1', label: 'bc1q****k2g7', removable: true }]],
]);
let credSeq = 0;
const mask = (s: string): string => '****' + s.replace(/\s/g, '').slice(-4);

function sourceActive(type: string): boolean {
  switch (type) {
    case 'plaid':
      return effectiveSetting('plaid.client_id') !== '' && effectiveSetting('plaid.secret') !== '';
    case 'teller':
      return effectiveSetting('teller.certificate') !== '' || (sourceEntries.get('teller')?.length ?? 0) > 0;
    case 'ethereum':
      return effectiveSetting('ethereum.api_key') !== '';
    default:
      return true;
  }
}

function buildSources(): SourceDTO[] {
  return SOURCE_DEFS.map((d) => {
    const config = SETTING_DEFS.filter((s) => s.source === d.type).map(settingStatus);
    const entries = sourceEntries.get(d.type) ?? [];
    const connected = d.multi ? entries.length > 0 : sourceConnected.has(d.type);
    return {
      type: d.type,
      archetype: d.archetype,
      title: d.title,
      connected,
      credentialed: d.credentialed,
      multi_credential: d.multi,
      oauth: d.oauth,
      credentials: d.credentials.length > 0 ? d.credentials : undefined,
      credential_entries: d.multi ? entries : undefined,
      egress: d.egress,
      active: sourceActive(d.type),
      config,
    };
  });
}

const syncRuns: SyncLog[] = [syncLog];

function addSyncRun(): void {
  syncRuns.unshift({
    id: 1000 + syncRuns.length,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    status: 'completed',
  });
}

// --- Manual create/edit helpers ---------------------------------------------

let manualSeq = 0;
const genId = (prefix: string): string =>
  `${prefix}_${(manualSeq++).toString(36)}${Math.floor(rand() * 1e6).toString(36)}`;

function toIso(v?: string): string | undefined {
  if (!v) return undefined;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

function makeManualTxn(b: Partial<TransactionInput>): Transaction {
  return {
    id: genId('man'),
    account_id: b.account_id ?? accounts[0]?.id ?? '',
    amount: String(b.amount ?? '0'),
    pending: !!b.pending,
    date: toIso(b.date) ?? iso(now),
    description: b.description ?? '',
    payee: b.payee ?? '',
    memo: b.memo ?? '',
    synced_at: iso(now),
    source: 'manual',
    labels: {},
    extensions: {},
    relationships: [],
  };
}

// --- Transaction detail + events fixtures -----------------------------------

function relationshipsFor(id: string): RelationshipEdge[] {
  const t = transactions.find((x) => x.id === id);
  const out: RelationshipEdge[] = (t?.relationships ?? []).map((r) => ({
    kind: r.kind,
    target: r.target,
    direction: 'outbound',
  }));
  const inbound: RelationshipEdge[] = [];
  for (const o of transactions) {
    if (o.id === id) continue;
    for (const r of o.relationships ?? []) {
      if (r.target === id) inbound.push({ kind: r.kind, target: o.id, direction: 'inbound' });
    }
  }
  return [...out, ...inbound];
}

function institutionFor(accountId: string): string {
  const acc = accounts.find((a) => a.id === accountId);
  const org = organizations.find((o) => o.id === acc?.org_id);
  return org?.name ?? '';
}

function mockEventRows(): KasasEventRow[] {
  const recent = [...transactions]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-80);
  return recent.map((t, i) => ({
    sequence: i + 1,
    event_id: `ev_${i + 1}`,
    type: 'transaction.created',
    entity_type: 'transaction',
    entity_id: t.id,
    occurred_at: t.date,
    data: { amount: t.amount, payee: t.payee, account_id: t.account_id },
  }));
}

// --- Rules / webhooks / api keys / security (mutable) ------------------------

let ruleSeq = 2;
const rules: Rule[] = [
  { id: 1, name: 'Coffee', query: 'coffee', labels: { category: 'dining' }, extensions: {}, enabled: true, created_at: iso(now - 30 * DAY), updated_at: iso(now - 30 * DAY) },
  { id: 2, name: 'Payroll', query: 'payee:Initech', labels: { category: 'income' }, extensions: {}, enabled: true, created_at: iso(now - 30 * DAY), updated_at: iso(now - 30 * DAY) },
];

let whSeq = 1;
const webhooks: Webhook[] = [
  { id: 1, url: 'https://example.com/hooks/kasas', event_types: ['*'], enabled: true, created_at: iso(now - 10 * DAY), updated_at: iso(now - 10 * DAY), last_status: 200, last_attempt_at: iso(now - DAY), last_success_at: iso(now - DAY) },
];

let keySeq = 1;
const apiKeys: ApiKey[] = [
  { id: 1, name: 'MCP client', prefix: 'kasas_ab', scope: 'read', created_at: iso(now - 5 * DAY), last_used_at: iso(now - 2 * 3600_000) },
];

const mockSecurity = { auth_required: false, token_source: 'none' };
const secret = (prefix: string): string => `${prefix}_${genId('').slice(2)}${genId('').slice(2)}`;

function samplePageDoc(note?: string): PluginPageDoc {
  const blocks: PageBlock[] = [
    { type: 'heading', text: 'Budget Coach' },
    { type: 'text', text: 'Your weekly spending insights, rendered natively by sillview from the plugin pageDoc.' },
    { type: 'stat', label: 'This week', value: '$432.18', hint: '12% under your 4-week average' },
    { type: 'keyvalue', items: [{ key: 'Top category', value: 'dining' }, { key: 'Transactions', value: '37' }] },
    { type: 'table', columns: ['Category', 'Spent'], rows: [['dining', '$182.40'], ['groceries', '$143.02'], ['transport', '$54.10']] },
    { type: 'divider' },
    { type: 'actions', actions: [{ id: 'recompute', label: 'Recompute', style: 'primary' }, { id: 'reset', label: 'Reset', style: 'danger' }] },
    {
      type: 'form',
      id: 'set-budget',
      submit_label: 'Save budget',
      fields: [
        { name: 'weekly', label: 'Weekly budget', kind: 'number', value: '500' },
        { name: 'notify', label: 'Notify on overage', kind: 'toggle', value: 'true' },
      ],
    },
  ];
  if (note) blocks.push({ type: 'text', text: note });
  return { title: 'Budget Coach', blocks };
}

// --- Plugins + marketplace (mutable) ----------------------------------------

const pluginsEnabled = (): boolean =>
  effectiveSetting('plugins.enabled') === 'true' && effectiveSetting('events.enabled') === 'true';
const registryEnabled = (): boolean => effectiveSetting('plugins.registry.enabled') === 'true';

let plugSeq = 2;
const mockPlugins: Plugin[] = [
  {
    id: 1, name: 'auto-categorizer', runtime: 'lua', version: '1.2.0',
    description: 'Auto-labels transactions by payee rules.',
    enabled: true, loaded: true, on_disk: true, state: 'loaded',
    hooks: ['OnTransactionCreate'], capabilities: ['labels:write', 'transactions:read'],
    granted_capabilities: ['labels:write', 'transactions:read'], net_allow: [], net_grants: [],
    last_status: 200, last_run_at: iso(now - 3600_000), last_success_at: iso(now - 3600_000),
  },
  {
    id: 2, name: 'paperless-sync', runtime: 'js', version: '0.4.1',
    description: 'Attaches receipts from a Paperless server.',
    enabled: false, loaded: false, on_disk: true, state: 'disabled',
    hooks: ['OnTransactionCreate', 'OnPageRender'], capabilities: ['net:fetch', 'extensions:write'],
    granted_capabilities: [], net_allow: ['paperless.lan', 'api.example.com'], net_grants: [],
    last_status: 0, last_run_at: null, last_success_at: null,
  },
];

const mockRegistry: RegistryPlugin[] = [
  {
    name: 'auto-categorizer', version: '1.2.0', description: 'Auto-labels transactions by payee rules.',
    author: 'kasas', license: 'MIT', homepage: 'https://example.com', runtime: 'lua',
    hooks: ['OnTransactionCreate'], capabilities: ['labels:write'], capability_tier: 'standard',
    tier: 'verified', installed: true, installed_version: '1.2.0', update_available: false,
  },
  {
    name: 'paperless-sync', version: '0.5.0', description: 'Attaches receipts from a Paperless server.',
    author: 'community', license: 'MIT', homepage: '', runtime: 'js',
    hooks: ['OnTransactionCreate', 'OnPageRender'], capabilities: ['net:fetch'], capability_tier: 'elevated',
    tier: 'connected', net: { allow: ['paperless.lan'] }, installed: true, installed_version: '0.4.1', update_available: true,
  },
  {
    name: 'budget-coach', version: '2.0.0', description: 'Weekly spending insights via a plugin page.',
    author: 'community', license: 'MIT', homepage: '', runtime: 'wasm',
    hooks: ['OnPageRender', 'OnPageAction'], capabilities: ['transactions:read'], capability_tier: 'standard',
    tier: 'connected', installed: false, update_available: false,
  },
];

const ok = (data: unknown): KasasResult => ({ ok: true, status: 200, data });

const notFound = (what: string): KasasResult => ({ ok: false, status: 404, error: `mock: ${what} not found` });

// --- Market / reference data fixtures (ADR 0006) ----------------------------
// A couple of seeded series with deterministic synthetic daily closes generated
// relative to `now`, so the benchmark/series widgets render offline. Values are
// decimal STRINGS, like real market data.

interface MockSeries {
  id: string;
  symbol: string;
  kind: string;
  currency: string;
  adjusted: boolean;
  name: string;
}

const marketSeries: MockSeries[] = [
  { id: 'spy', symbol: 'SPY', kind: 'index', currency: 'USD', adjusted: false, name: 'S&P 500 ETF (SPY)' },
  { id: 'agg', symbol: 'AGG', kind: 'index', currency: 'USD', adjusted: false, name: 'US Aggregate Bond ETF' },
];
const marketConfigured = true; // mock has a "key" so widgets show data offline

const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const seedFor = (id: string): number => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const startValue = (id: string): number => ({ spy: 480, agg: 98 } as Record<string, number>)[id] ?? 100;

/** ~180 deterministic daily closes ending today, with a gentle upward drift. */
function marketPointsFor(id: string): { date: string; value: string }[] {
  const r = mulberry32(seedFor(id));
  const days = 180;
  let v = startValue(id) * 0.9;
  const out: { date: string; value: string }[] = [];
  for (let i = days; i >= 0; i--) {
    v = v * (1 + (r() - 0.46) * 0.02);
    out.push({ date: isoDate(now - i * DAY), value: v.toFixed(4) });
  }
  return out;
}

function marketSeriesList() {
  return marketSeries.map((s) => {
    const pts = marketPointsFor(s.id);
    return {
      ...s,
      provider: 'mock',
      as_of: pts[pts.length - 1].date,
      points: pts.length,
      fetched_at: Math.floor(now / 1000),
      fresh: true,
    };
  });
}

function route(req: KasasRequest): KasasResult {
  const { path, query } = req;

  if (path === '/api/v1/auth') return ok(authStatus);
  if (path === '/api/v1/organizations') return ok({ organizations });
  if (path === '/api/v1/accounts') {
    const orgId = query?.org_id;
    return ok({ accounts: orgId ? accounts.filter((a) => a.org_id === String(orgId)) : accounts });
  }

  const accTxn = path.match(/^\/api\/v1\/accounts\/([^/]+)\/transactions$/);
  if (accTxn) return ok({ transactions: queryTxns({ ...query, account_id: accTxn[1] }) });

  if (path === '/api/v1/transactions') return ok({ transactions: queryTxns(query) });

  if (path === '/api/v1/transactions/search') {
    const q = String(query?.q ?? '').toLowerCase();
    const matched = transactions.filter((t) =>
      [t.description, t.payee, t.memo].some((s) => s.toLowerCase().includes(q)),
    );
    return ok({ query: q, total: matched.length, transactions: applyWindow(matched, query) });
  }

  if (path === '/api/v1/labels' && req.method === 'GET') return ok({ labels: computeLabels() });
  if (path === '/api/v1/sync' && req.method === 'GET') return ok({ latest: syncLog });

  // --- transaction mutations ---------------------------------------------
  if (path === '/api/v1/transactions' && req.method === 'POST') {
    const txn = makeManualTxn((req.body as Partial<TransactionInput>) ?? {});
    transactions.push(txn);
    return { ok: true, status: 201, data: txn };
  }
  const txnLabels = path.match(/^\/api\/v1\/transactions\/([^/]+)\/labels$/);
  if (txnLabels && req.method === 'PUT') {
    const t = transactions.find((x) => x.id === txnLabels[1]);
    if (!t) return { ok: false, status: 404, error: 'mock: transaction not found' };
    const labels = (req.body as { labels?: Record<string, string> } | undefined)?.labels ?? {};
    t.labels = labels;
    return ok({ id: t.id, labels });
  }
  const txnId = path.match(/^\/api\/v1\/transactions\/([^/]+)$/);
  if (txnId && req.method === 'GET') {
    const t = transactions.find((x) => x.id === txnId[1]);
    if (!t) return { ok: false, status: 404, error: 'mock: transaction not found' };
    return ok(t);
  }
  if (txnId && (req.method === 'PUT' || req.method === 'DELETE')) {
    const idx = transactions.findIndex((t) => t.id === txnId[1]);
    if (idx < 0) return { ok: false, status: 404, error: 'mock: transaction not found' };
    const t = transactions[idx];
    if (t.source !== 'manual') {
      return { ok: false, status: 409, error: 'only manually-created transactions can be edited or deleted' };
    }
    if (req.method === 'DELETE') {
      transactions.splice(idx, 1);
      return ok({ id: txnId[1], deleted: true });
    }
    const b = (req.body as Partial<TransactionInput>) ?? {};
    Object.assign(t, {
      account_id: b.account_id ?? t.account_id,
      amount: String(b.amount ?? t.amount),
      date: toIso(b.date) ?? t.date,
      description: b.description ?? '',
      payee: b.payee ?? '',
      memo: b.memo ?? '',
      pending: !!b.pending,
    });
    return ok(t);
  }

  // --- account mutations -------------------------------------------------
  if (path === '/api/v1/accounts' && req.method === 'POST') {
    const b = (req.body as Partial<AccountInput>) ?? {};
    const acc: Account = {
      id: genId('man_acct'),
      org_id: 'manual',
      name: b.name ?? 'Account',
      currency: b.currency ?? 'USD',
      balance: b.balance && b.balance.trim() !== '' ? b.balance : '0',
      balance_date: toIso(b.balance_date) ?? iso(now),
      synced_at: iso(now),
      source: 'manual',
    };
    accounts.push(acc);
    return { ok: true, status: 201, data: acc };
  }
  const accId = path.match(/^\/api\/v1\/accounts\/([^/]+)$/);
  if (accId && (req.method === 'PUT' || req.method === 'DELETE')) {
    const idx = accounts.findIndex((a) => a.id === accId[1]);
    if (idx < 0) return { ok: false, status: 404, error: 'mock: account not found' };
    const a = accounts[idx];
    if (a.source !== 'manual') {
      return { ok: false, status: 409, error: 'only manually-created accounts can be edited or deleted' };
    }
    if (req.method === 'DELETE') {
      accounts.splice(idx, 1);
      for (let i = transactions.length - 1; i >= 0; i--) {
        if (transactions[i].account_id === accId[1]) transactions.splice(i, 1);
      }
      return ok({ id: accId[1], deleted: true });
    }
    const b = (req.body as Partial<AccountInput>) ?? {};
    Object.assign(a, {
      name: b.name ?? a.name,
      currency: b.currency ?? a.currency,
      balance: b.balance && b.balance.trim() !== '' ? b.balance : a.balance,
      balance_date: toIso(b.balance_date) ?? a.balance_date,
    });
    return ok(a);
  }

  // --- delete a label across all transactions ----------------------------
  const delLabel = path.match(/^\/api\/v1\/labels\/([^/]+)$/);
  if (delLabel && req.method === 'DELETE') {
    const key = decodeURIComponent(delLabel[1]);
    const value = query?.value !== undefined ? String(query.value) : undefined;
    for (const t of transactions) {
      if (t.labels[key] !== undefined && (value === undefined || t.labels[key] === value)) {
        const next = { ...t.labels };
        delete next[key];
        t.labels = next;
      }
    }
    return ok(value !== undefined ? { key, value } : { key });
  }

  // --- transaction detail: history / provenance / relationships ----------
  const histMatch = path.match(/^\/api\/v1\/transactions\/([^/]+)\/history$/);
  if (histMatch && req.method === 'GET') {
    const t = transactions.find((x) => x.id === histMatch[1]);
    if (!t) return { ok: false, status: 404, error: 'mock: transaction not found' };
    return ok({
      transaction_id: t.id,
      versions: [
        {
          version: 1,
          change_kind: 'imported',
          occurred_at: t.date,
          transaction: { ...t },
          diff: {
            fields: [],
            labels_added: t.labels ?? {},
            labels_removed: {},
            labels_changed: {},
            extensions_added: {},
            extensions_removed: {},
            extensions_changed: {},
          },
        },
      ],
    });
  }
  const provMatch = path.match(/^\/api\/v1\/transactions\/([^/]+)\/provenance$/);
  if (provMatch && req.method === 'GET') {
    const t = transactions.find((x) => x.id === provMatch[1]);
    if (!t) return { ok: false, status: 404, error: 'mock: transaction not found' };
    return ok({
      transaction_id: t.id,
      source: t.source,
      source_transaction_id: t.id,
      account_id: t.account_id,
      institution: institutionFor(t.account_id),
      imported_at: t.synced_at,
      last_seen: t.synced_at,
      transformations: [{ kind: 'imported', occurred_at: t.date, summary: `Imported from ${t.source}` }],
    });
  }
  const relMatch = path.match(/^\/api\/v1\/transactions\/([^/]+)\/relationships$/);
  if (relMatch) {
    const id = relMatch[1];
    const t = transactions.find((x) => x.id === id);
    if (!t) return { ok: false, status: 404, error: 'mock: transaction not found' };
    const body = req.body as { kind?: string; target?: string } | undefined;
    if (req.method === 'POST' && body?.kind && body?.target) {
      if (!(t.relationships ?? []).some((r) => r.kind === body.kind && r.target === body.target)) {
        t.relationships = [...(t.relationships ?? []), { kind: body.kind, target: body.target }];
      }
      return { ok: true, status: 201, data: { id, relationships: relationshipsFor(id) } };
    }
    if (req.method === 'DELETE' && body?.kind && body?.target) {
      t.relationships = (t.relationships ?? []).filter((r) => !(r.kind === body.kind && r.target === body.target));
      return ok({ id, relationships: relationshipsFor(id) });
    }
    if (req.method === 'GET') return ok({ id, relationships: relationshipsFor(id) });
  }
  if (path === '/api/v1/relationships' && req.method === 'GET') {
    const counts = new Map<string, number>();
    for (const t of transactions) for (const r of t.relationships ?? []) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    return ok({
      relationships: [...counts.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => a.kind.localeCompare(b.kind)),
    });
  }

  // --- events ------------------------------------------------------------
  if (path === '/api/v1/events' && req.method === 'GET') {
    const rows = mockEventRows();
    const limit = Number(query?.limit ?? 60) || 60;
    if (query?.newest !== undefined) return ok({ events: rows.slice(-limit), next: rows.length });
    const after = Number(query?.after ?? 0) || 0;
    return ok({ events: rows.filter((r) => r.sequence > after).slice(0, limit), next: rows.length });
  }

  // --- rules -------------------------------------------------------------
  if (path === '/api/v1/rules' && req.method === 'GET') return ok({ rules });
  if (path === '/api/v1/rules' && req.method === 'POST') {
    const b = (req.body as Partial<RuleInput>) ?? {};
    const r: Rule = {
      id: ++ruleSeq,
      name: b.name ?? '',
      query: b.query ?? '',
      labels: b.labels ?? {},
      extensions: (b.extensions as Record<string, unknown>) ?? {},
      enabled: b.enabled ?? true,
      created_at: iso(now),
      updated_at: iso(now),
    };
    rules.push(r);
    return { ok: true, status: 201, data: r };
  }
  if (path === '/api/v1/rules/run' && req.method === 'POST') return ok({ matched: 12, updated: 8 });
  const ruleRun = path.match(/^\/api\/v1\/rules\/(\d+)\/run$/);
  if (ruleRun && req.method === 'POST') return ok({ matched: 5, updated: 3 });
  const ruleId = path.match(/^\/api\/v1\/rules\/(\d+)$/);
  if (ruleId) {
    const id = Number(ruleId[1]);
    const idx = rules.findIndex((r) => r.id === id);
    if (idx < 0) return notFound('rule');
    if (req.method === 'PUT') {
      const b = (req.body as Partial<RuleInput>) ?? {};
      Object.assign(rules[idx], {
        name: b.name ?? rules[idx].name,
        query: b.query ?? rules[idx].query,
        labels: b.labels ?? rules[idx].labels,
        extensions: (b.extensions as Record<string, unknown>) ?? rules[idx].extensions,
        enabled: b.enabled ?? rules[idx].enabled,
        updated_at: iso(now),
      });
      return ok(rules[idx]);
    }
    if (req.method === 'DELETE') {
      rules.splice(idx, 1);
      return ok({ id, deleted: true });
    }
  }

  // --- webhooks ----------------------------------------------------------
  if (path === '/api/v1/webhooks' && req.method === 'GET') {
    return ok({ webhooks: webhooks.map((w) => ({ ...w, secret: undefined })) });
  }
  if (path === '/api/v1/webhooks' && req.method === 'POST') {
    const b = (req.body as Partial<WebhookInput>) ?? {};
    const wh: Webhook = {
      id: ++whSeq,
      url: b.url ?? '',
      event_types: b.event_types ?? ['*'],
      enabled: b.enabled ?? true,
      created_at: iso(now),
      updated_at: iso(now),
      last_status: 0,
      last_attempt_at: null,
      last_success_at: null,
    };
    webhooks.push(wh);
    return { ok: true, status: 201, data: { ...wh, secret: secret('whsec') } };
  }
  const whTest = path.match(/^\/api\/v1\/webhooks\/(\d+)\/test$/);
  if (whTest && req.method === 'POST') return ok({ status: 200, delivered: true });
  const whRotate = path.match(/^\/api\/v1\/webhooks\/(\d+)\/rotate-secret$/);
  if (whRotate && req.method === 'POST') {
    const wh = webhooks.find((w) => w.id === Number(whRotate[1]));
    if (!wh) return notFound('webhook');
    return ok({ ...wh, secret: secret('whsec') });
  }
  const whId = path.match(/^\/api\/v1\/webhooks\/(\d+)$/);
  if (whId) {
    const id = Number(whId[1]);
    const idx = webhooks.findIndex((w) => w.id === id);
    if (idx < 0) return notFound('webhook');
    if (req.method === 'GET') return ok({ ...webhooks[idx], secret: secret('whsec') });
    if (req.method === 'PUT') {
      const b = (req.body as Partial<WebhookInput>) ?? {};
      Object.assign(webhooks[idx], {
        url: b.url ?? webhooks[idx].url,
        event_types: b.event_types ?? webhooks[idx].event_types,
        enabled: b.enabled ?? webhooks[idx].enabled,
        updated_at: iso(now),
      });
      return ok({ ...webhooks[idx] });
    }
    if (req.method === 'DELETE') {
      webhooks.splice(idx, 1);
      return ok({ id, deleted: true });
    }
  }

  // --- security: token + api keys ----------------------------------------
  if (path === '/api/v1/security/token' && req.method === 'POST') {
    const b = req.body as { token?: string } | undefined;
    const token = b?.token && b.token.trim() !== '' ? b.token : secret('kasas');
    mockSecurity.auth_required = true;
    mockSecurity.token_source = 'stored';
    return ok({ token, auth_required: true, token_source: 'stored' });
  }
  if (path === '/api/v1/security/token' && req.method === 'DELETE') {
    mockSecurity.auth_required = false;
    mockSecurity.token_source = 'none';
    return ok({ auth_required: false, token_source: 'none' });
  }
  if (path === '/api/v1/security/api-keys' && req.method === 'GET') return ok({ api_keys: apiKeys });
  if (path === '/api/v1/security/api-keys' && req.method === 'POST') {
    const b = (req.body as Partial<ApiKeyInput>) ?? {};
    const full = secret('kasas');
    const k: ApiKey = {
      id: ++keySeq,
      name: b.name ?? '',
      prefix: full.slice(0, 10),
      scope: b.scope ?? 'read',
      created_at: iso(now),
      last_used_at: null,
    };
    apiKeys.push(k);
    return { ok: true, status: 201, data: { ...k, key: full } };
  }
  const keyId = path.match(/^\/api\/v1\/security\/api-keys\/(\d+)$/);
  if (keyId && req.method === 'DELETE') {
    const id = Number(keyId[1]);
    const idx = apiKeys.findIndex((k) => k.id === id);
    if (idx >= 0) apiKeys.splice(idx, 1);
    return ok({ id, revoked: true });
  }

  // --- plugins -----------------------------------------------------------
  if (path === '/api/v1/plugins' && req.method === 'GET') {
    return ok({ enabled: pluginsEnabled(), plugins: pluginsEnabled() ? mockPlugins : [] });
  }
  if (path === '/api/v1/plugins/registry' && req.method === 'GET') {
    return ok({ available: registryEnabled(), plugins: registryEnabled() ? mockRegistry : [] });
  }
  if (path === '/api/v1/plugins/pages' && req.method === 'GET') {
    return ok({ pages: pluginsEnabled() ? [{ name: 'budget-coach', title: 'Budget Coach', icon: '' }] : [] });
  }
  const pageAction = path.match(/^\/api\/v1\/plugins\/pages\/([^/]+)\/action$/);
  if (pageAction && req.method === 'POST') {
    const b = req.body as { id?: string; params?: Record<string, string> } | undefined;
    const detail = b?.params && Object.keys(b.params).length ? ` with ${JSON.stringify(b.params)}` : '';
    return ok({ name: decodeURIComponent(pageAction[1]), page: samplePageDoc(`Action "${b?.id}" ran${detail}.`) });
  }
  const pageRender = path.match(/^\/api\/v1\/plugins\/pages\/([^/]+)$/);
  if (pageRender && req.method === 'GET') {
    return ok({ name: decodeURIComponent(pageRender[1]), page: samplePageDoc() });
  }
  const plugInstall = path.match(/^\/api\/v1\/plugins\/registry\/([^/]+)\/install$/);
  if (plugInstall && req.method === 'POST') {
    const name = decodeURIComponent(plugInstall[1]);
    const reg = mockRegistry.find((r) => r.name === name);
    if (reg) {
      reg.installed = true;
      reg.installed_version = reg.version;
      reg.update_available = false;
    }
    let p = mockPlugins.find((x) => x.name === name);
    if (!p && reg) {
      p = {
        id: ++plugSeq, name, runtime: reg.runtime, version: reg.version, description: reg.description,
        enabled: false, loaded: false, on_disk: true, state: 'disabled', hooks: reg.hooks,
        capabilities: reg.capabilities, granted_capabilities: [], net_allow: reg.net?.allow ?? [],
        net_grants: [], last_status: 0, last_run_at: null, last_success_at: null,
      };
      mockPlugins.push(p);
    } else if (p && reg) {
      p.version = reg.version;
    }
    return ok(p ?? {});
  }
  const plugEnable = path.match(/^\/api\/v1\/plugins\/(\d+)\/enable$/);
  if (plugEnable && req.method === 'POST') {
    const p = mockPlugins.find((x) => x.id === Number(plugEnable[1]));
    if (!p) return notFound('plugin');
    const b = req.body as { net_grants?: string[] } | undefined;
    p.enabled = true;
    p.loaded = true;
    p.state = 'loaded';
    p.granted_capabilities = [...p.capabilities];
    p.net_grants = b?.net_grants ?? [];
    return ok(p);
  }
  const plugDisable = path.match(/^\/api\/v1\/plugins\/(\d+)\/disable$/);
  if (plugDisable && req.method === 'POST') {
    const p = mockPlugins.find((x) => x.id === Number(plugDisable[1]));
    if (!p) return notFound('plugin');
    p.enabled = false;
    p.loaded = false;
    p.state = 'disabled';
    return ok(p);
  }
  const plugReload = path.match(/^\/api\/v1\/plugins\/(\d+)\/reload$/);
  if (plugReload && req.method === 'POST') {
    const p = mockPlugins.find((x) => x.id === Number(plugReload[1]));
    if (!p) return notFound('plugin');
    return ok(p);
  }
  const plugEgress = path.match(/^\/api\/v1\/plugins\/(\d+)\/egress$/);
  if (plugEgress && req.method === 'GET') {
    return ok({
      enabled: pluginsEnabled(),
      entries: [
        { time: iso(now - 1800_000), method: 'GET', host: 'paperless.lan', url: 'https://paperless.lan/api/documents', status: 200, bytes: 4213, duration_ms: 87 },
        { time: iso(now - 3600_000), method: 'POST', host: 'api.example.com', url: 'https://api.example.com/v1/sync', status: 200, bytes: 512, duration_ms: 142 },
      ],
    });
  }
  const plugId = path.match(/^\/api\/v1\/plugins\/(\d+)$/);
  if (plugId && req.method === 'DELETE') {
    const id = Number(plugId[1]);
    const idx = mockPlugins.findIndex((p) => p.id === id);
    const name = idx >= 0 ? mockPlugins[idx].name : '';
    if (idx >= 0) mockPlugins.splice(idx, 1);
    const reg = mockRegistry.find((r) => r.name === name);
    if (reg) {
      reg.installed = false;
      reg.installed_version = undefined;
      reg.update_available = false;
    }
    return ok({ name, uninstalled: true, hook_ran: true });
  }

  // --- settings / config / restart ---------------------------------------
  if (path === '/api/v1/settings' && req.method === 'GET') {
    const settings = SETTING_DEFS.map(settingStatus);
    return ok({ enabled: true, restart_required: settingOverrides.size > 0, settings });
  }
  const settingKey = path.match(/^\/api\/v1\/settings\/(.+)$/);
  if (settingKey) {
    const key = decodeURIComponent(settingKey[1]);
    const def = SETTING_DEFS.find((d) => d.key === key);
    if (!def) return { ok: false, status: 404, error: `mock: unknown setting ${key}` };
    if (req.method === 'PUT') {
      const value = String((req.body as { value?: unknown } | undefined)?.value ?? '');
      settingOverrides.set(key, value);
      return ok({ setting: settingStatus(def), restart_required: settingOverrides.size > 0 });
    }
    if (req.method === 'DELETE') {
      settingOverrides.delete(key);
      return ok({ setting: settingStatus(def), restart_required: settingOverrides.size > 0 });
    }
  }
  if (path === '/api/v1/config') return ok(mockConfig());
  if (path === '/api/v1/update' && req.method === 'GET') {
    return ok({
      current: 'v2.29.2',
      latest: 'v2.29.2',
      update_available: false,
      release_url: 'https://github.com/paulmeier/kasas/releases',
      checked_at: iso(now),
      can_apply: false,
    });
  }
  if (path === '/api/v1/system/restart' && req.method === 'POST') {
    settingOverrides.clear(); // a restart applies pending overrides -> no longer "pending"
    return ok({ restarting: true });
  }

  // --- sources & sync ----------------------------------------------------
  if (path === '/api/v1/sources' && req.method === 'GET') {
    return ok({ enabled: true, restart_required: settingOverrides.size > 0, sources: buildSources() });
  }
  const srcSync = path.match(/^\/api\/v1\/sources\/([^/]+)\/sync$/);
  if (srcSync && req.method === 'POST') {
    addSyncRun();
    return { ok: true, status: 202, data: { status: 'sync started' } };
  }
  const srcCred = path.match(/^\/api\/v1\/sources\/([^/]+)\/credential$/);
  if (srcCred && req.method === 'PUT') {
    const type = srcCred[1];
    const def = SOURCE_DEFS.find((d) => d.type === type);
    const token = String((req.body as { token?: unknown } | undefined)?.token ?? '');
    if (def?.multi) {
      credSeq += 1;
      const entries = sourceEntries.get(type) ?? [];
      entries.push({ id: `c${credSeq}`, label: mask(token), removable: true });
      sourceEntries.set(type, entries);
      return ok({ connected: true });
    }
    sourceConnected.add(type);
    return ok({ connected: true });
  }
  const srcCredDel = path.match(/^\/api\/v1\/sources\/([^/]+)\/credentials\/([^/]+)$/);
  if (srcCredDel && req.method === 'DELETE') {
    const [, type, id] = srcCredDel;
    const entries = (sourceEntries.get(type) ?? []).filter((c) => c.id !== id);
    sourceEntries.set(type, entries);
    return ok({ connected: entries.length > 0 });
  }
  const srcOAuth = path.match(/^\/api\/v1\/sources\/([^/]+)\/oauth\/start$/);
  if (srcOAuth) {
    return ok({ url: 'https://accounts.google.com/o/oauth2/v2/auth?mock=1&source=' + srcOAuth[1] });
  }
  if (path === '/api/v1/sync' && req.method === 'POST') {
    addSyncRun();
    return { ok: true, status: 202, data: { status: 'sync started' } };
  }
  if (path === '/api/v1/sync/history') {
    const limit = Number(query?.limit ?? 20) || 20;
    return ok({ history: syncRuns.slice(0, limit) });
  }

  // --- market / reference data (ADR 0006) --------------------------------
  if (path === '/api/v1/market/series' && req.method === 'GET') {
    return ok({ enabled: true, provider: 'mock', configured: marketConfigured, series: marketSeriesList() });
  }
  if (path === '/api/v1/market/series' && req.method === 'POST') {
    const b = (req.body ?? {}) as Partial<MockSeries>;
    const id = String(b.id ?? '').trim();
    if (!id) return { ok: false, status: 400, error: 'mock: series id required' };
    if (marketSeries.some((s) => s.id === id)) return { ok: false, status: 409, error: 'mock: duplicate id' };
    const s: MockSeries = {
      id,
      symbol: String(b.symbol ?? id).trim(),
      kind: String(b.kind ?? 'equity'),
      currency: String(b.currency ?? 'USD'),
      adjusted: Boolean(b.adjusted),
      name: String(b.name ?? ''),
    };
    marketSeries.push(s);
    return { ok: true, status: 201, data: { ...s, provider: 'mock', points: 0, fresh: false } };
  }
  const mktPoints = path.match(/^\/api\/v1\/market\/series\/([^/]+)\/points$/);
  if (mktPoints && req.method === 'GET') {
    const id = mktPoints[1];
    if (!marketSeries.some((s) => s.id === id)) return notFound(`series ${id}`);
    let pts = marketPointsFor(id);
    const since = query?.since ? String(query.since) : '';
    const until = query?.until ? String(query.until) : '';
    if (since) pts = pts.filter((p) => p.date >= since);
    if (until) pts = pts.filter((p) => p.date <= until);
    return ok({ provider: 'mock', as_of: pts[pts.length - 1]?.date ?? '', fresh: true, points: pts });
  }
  const mktDel = path.match(/^\/api\/v1\/market\/series\/([^/]+)$/);
  if (mktDel && req.method === 'DELETE') {
    const id = mktDel[1];
    const i = marketSeries.findIndex((s) => s.id === id);
    if (i < 0) return notFound(`series ${id}`);
    marketSeries.splice(i, 1);
    return ok({ id, deleted: true });
  }

  return { ok: false, status: 404, error: `mock: no fixture for ${req.method} ${path}` };
}

/** Drop-in stand-in for `kasasRequest` when KASAS_MOCK is set. Never throws. */
export function mockKasasRequest<T = unknown>(req: KasasRequest): Promise<KasasResult<T>> {
  return Promise.resolve(route(req) as KasasResult<T>);
}

// --- Synthetic live events (for the SSE stream in mock mode) -----------------

const EVENT_TYPES = ['transaction.created', 'account.updated', 'sync.completed', 'label.applied'];
let eventSeq = 1000;

/** One plausible change event, emitted on a timer by the mocked EventStream. */
export function syntheticEvent(): KasasEvent {
  eventSeq += 1;
  const type = EVENT_TYPES[eventSeq % EVENT_TYPES.length];
  return { type, sequence: eventSeq, data: { at: new Date().toISOString() } };
}
