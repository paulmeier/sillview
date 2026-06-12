/**
 * Typed kasas client for the renderer. Every call goes through `window.api.kasas`
 * (the main-process broker) — the renderer never touches the network directly,
 * which is how we sidestep kasas's lack of CORS.
 */

import type { KasasRequest } from '../../shared/ipc';
import type {
  Account,
  AccountInput,
  AccountsResponse,
  AuthStatus,
  ConfigDTO,
  Label,
  LabelsResponse,
  ApiKey,
  ApiKeyInput,
  EgressResponse,
  EventsResponse,
  KasasUpdateStatus,
  Organization,
  OrganizationsResponse,
  Plugin,
  PluginPageResponse,
  PluginPagesResponse,
  PluginsResponse,
  Provenance,
  RegistryResponse,
  RelationshipKind,
  RelationshipsResponse,
  Rule,
  RuleInput,
  RuleRunResult,
  SearchResponse,
  SetSettingResponse,
  SettingsListResponse,
  SourcesListResponse,
  SyncHistoryResponse,
  SyncLog,
  SyncStatusResponse,
  TokenResponse,
  Transaction,
  TransactionHistory,
  TransactionInput,
  TransactionQuery,
  TransactionsResponse,
  UninstallResult,
  Webhook,
  WebhookInput,
  WebhookTestResult,
} from '../../shared/kasas-types';

export class KasasError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'KasasError';
  }
}

async function request<T>(req: KasasRequest): Promise<T> {
  const res = await window.api.kasas.request<T>(req);
  if (!res.ok) {
    throw new KasasError(res.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.data as T;
}

type Query = KasasRequest['query'];

export const kasas = {
  authStatus: () => request<AuthStatus>({ method: 'GET', path: '/api/v1/auth' }),

  organizations: () =>
    request<OrganizationsResponse>({ method: 'GET', path: '/api/v1/organizations' }).then(
      (r) => r.organizations ?? [],
    ) as Promise<Organization[]>,

  accounts: (orgId?: string) =>
    request<AccountsResponse>({
      method: 'GET',
      path: '/api/v1/accounts',
      query: { org_id: orgId },
    }).then((r) => r.accounts ?? []) as Promise<Account[]>,

  accountTransactions: (accountId: string, query?: TransactionQuery) =>
    request<TransactionsResponse>({
      method: 'GET',
      path: `/api/v1/accounts/${accountId}/transactions`,
      query: query as Query,
    }).then((r) => r.transactions ?? []) as Promise<Transaction[]>,

  transactions: (query?: TransactionQuery) =>
    request<TransactionsResponse>({
      method: 'GET',
      path: '/api/v1/transactions',
      query: query as Query,
    }).then((r) => r.transactions ?? []) as Promise<Transaction[]>,

  search: (text: string, query?: TransactionQuery) =>
    request<SearchResponse>({
      method: 'GET',
      path: '/api/v1/transactions/search',
      query: { q: text, ...(query as Query) },
    }),

  labels: () =>
    request<LabelsResponse>({ method: 'GET', path: '/api/v1/labels' }).then(
      (r) => r.labels ?? [],
    ) as Promise<Label[]>,

  /** Remove a label from the vocabulary (every transaction). value scopes it. */
  deleteLabel: (key: string, value?: string) =>
    request<{ key: string; value?: string }>({
      method: 'DELETE',
      path: `/api/v1/labels/${encodeURIComponent(key)}`,
      query: value !== undefined ? { value } : undefined,
    }),

  // --- Transaction & account mutations (manual rows only; admin/write tier) ---

  /** Replace a transaction's full label set. */
  setLabels: (id: string, labels: Record<string, string>) =>
    request<{ id: string; labels: Record<string, string> }>({
      method: 'PUT',
      path: `/api/v1/transactions/${encodeURIComponent(id)}/labels`,
      body: { labels },
    }),

  createTransaction: (input: TransactionInput) =>
    request<Transaction>({ method: 'POST', path: '/api/v1/transactions', body: input }),

  updateTransaction: (id: string, input: TransactionInput) =>
    request<Transaction>({
      method: 'PUT',
      path: `/api/v1/transactions/${encodeURIComponent(id)}`,
      body: input,
    }),

  deleteTransaction: (id: string) =>
    request<{ id: string; deleted: boolean }>({
      method: 'DELETE',
      path: `/api/v1/transactions/${encodeURIComponent(id)}`,
    }),

  createAccount: (input: AccountInput) =>
    request<Account>({ method: 'POST', path: '/api/v1/accounts', body: input }),

  updateAccount: (id: string, input: AccountInput) =>
    request<Account>({
      method: 'PUT',
      path: `/api/v1/accounts/${encodeURIComponent(id)}`,
      body: input,
    }),

  deleteAccount: (id: string) =>
    request<{ id: string; deleted: boolean }>({
      method: 'DELETE',
      path: `/api/v1/accounts/${encodeURIComponent(id)}`,
    }),

  syncStatus: () =>
    request<SyncStatusResponse>({ method: 'GET', path: '/api/v1/sync' }).then(
      (r) => r.latest,
    ) as Promise<SyncLog | null>,

  // --- Settings / config (runtime config; admin tier) ---------------------

  settings: () => request<SettingsListResponse>({ method: 'GET', path: '/api/v1/settings' }),

  /** Set one setting override. `value` is always sent as a string (kasas parses it). */
  setSetting: (key: string, value: string) =>
    request<SetSettingResponse>({
      method: 'PUT',
      path: `/api/v1/settings/${encodeURIComponent(key)}`,
      body: { value },
    }),

  /** Clear an override so the config-file / env value applies again. */
  resetSetting: (key: string) =>
    request<SetSettingResponse>({
      method: 'DELETE',
      path: `/api/v1/settings/${encodeURIComponent(key)}`,
    }),

  /** Effective configuration (secrets redacted) for the read-only bootstrap view. */
  config: () => request<ConfigDTO>({ method: 'GET', path: '/api/v1/config' }),

  /** Re-exec kasas in place to apply restart-required settings (external mode). */
  restart: () =>
    request<{ restarting: boolean }>({ method: 'POST', path: '/api/v1/system/restart' }),

  /** Read-only kasas self-update status (external mode; bundled uses updater.ts). */
  updateStatus: () => request<KasasUpdateStatus>({ method: 'GET', path: '/api/v1/update' }),

  // --- Sources & sync -----------------------------------------------------

  sources: () => request<SourcesListResponse>({ method: 'GET', path: '/api/v1/sources' }),

  /** Paste a single credential (e.g. a SimpleFIN token) for a source. */
  setSourceCredential: (type: string, token: string) =>
    request<{ connected: boolean }>({
      method: 'PUT',
      path: `/api/v1/sources/${encodeURIComponent(type)}/credential`,
      body: { token },
    }),

  /** Remove one credential from a multi-credential source (e.g. one Teller bank). */
  removeSourceCredential: (type: string, id: string) =>
    request<{ connected: boolean }>({
      method: 'DELETE',
      path: `/api/v1/sources/${encodeURIComponent(type)}/credentials/${encodeURIComponent(id)}`,
    }),

  /** Begin a source's browser OAuth flow; returns the consent URL to open externally. */
  sourceOAuthStart: (type: string) =>
    request<{ url: string }>({
      method: 'GET',
      path: `/api/v1/sources/${encodeURIComponent(type)}/oauth/start`,
    }),

  /** Trigger a sync of one source (async; observe via syncStatus). */
  syncSource: (type: string) =>
    request<{ status: string }>({
      method: 'POST',
      path: `/api/v1/sources/${encodeURIComponent(type)}/sync`,
    }),

  /** Trigger a full sync of every source (async 202). */
  triggerSync: () => request<{ status: string }>({ method: 'POST', path: '/api/v1/sync' }),

  /** Recent sync runs (newest first). */
  syncHistory: (limit = 20) =>
    request<SyncHistoryResponse>({
      method: 'GET',
      path: '/api/v1/sync/history',
      query: { limit },
    }).then((r) => r.history ?? []) as Promise<SyncLog[]>,

  // --- Transaction detail: history / provenance / relationships -----------

  transactionHistory: (id: string) =>
    request<TransactionHistory>({
      method: 'GET',
      path: `/api/v1/transactions/${encodeURIComponent(id)}/history`,
    }),

  transactionProvenance: (id: string) =>
    request<Provenance>({
      method: 'GET',
      path: `/api/v1/transactions/${encodeURIComponent(id)}/provenance`,
    }),

  transactionRelationships: (id: string) =>
    request<RelationshipsResponse>({
      method: 'GET',
      path: `/api/v1/transactions/${encodeURIComponent(id)}/relationships`,
    }),

  addRelationship: (id: string, kind: string, target: string) =>
    request<RelationshipsResponse>({
      method: 'POST',
      path: `/api/v1/transactions/${encodeURIComponent(id)}/relationships`,
      body: { kind, target },
    }),

  removeRelationship: (id: string, kind: string, target: string) =>
    request<RelationshipsResponse>({
      method: 'DELETE',
      path: `/api/v1/transactions/${encodeURIComponent(id)}/relationships`,
      body: { kind, target },
    }),

  relationshipKinds: () =>
    request<{ relationships: RelationshipKind[] }>({
      method: 'GET',
      path: '/api/v1/relationships',
    }).then((r) => r.relationships ?? []) as Promise<RelationshipKind[]>,

  // --- Events -------------------------------------------------------------

  /** The tail of the event stream (most recent, chronological). */
  recentEvents: (limit = 60) =>
    request<EventsResponse>({
      method: 'GET',
      path: '/api/v1/events',
      query: { newest: true, limit },
    }),

  /** Forward cursor read from `after` (a sequence number). */
  events: (after: number, limit = 60) =>
    request<EventsResponse>({
      method: 'GET',
      path: '/api/v1/events',
      query: { after, limit },
    }),

  // --- Rules --------------------------------------------------------------

  rules: () =>
    request<{ rules: Rule[] }>({ method: 'GET', path: '/api/v1/rules' }).then(
      (r) => r.rules ?? [],
    ) as Promise<Rule[]>,
  createRule: (input: RuleInput) => request<Rule>({ method: 'POST', path: '/api/v1/rules', body: input }),
  updateRule: (id: number, input: RuleInput) =>
    request<Rule>({ method: 'PUT', path: `/api/v1/rules/${id}`, body: input }),
  deleteRule: (id: number) =>
    request<{ id: number; deleted: boolean }>({ method: 'DELETE', path: `/api/v1/rules/${id}` }),
  runRule: (id: number) =>
    request<RuleRunResult>({ method: 'POST', path: `/api/v1/rules/${id}/run` }),
  runAllRules: () => request<RuleRunResult>({ method: 'POST', path: '/api/v1/rules/run' }),

  // --- Webhooks -----------------------------------------------------------

  webhooks: () =>
    request<{ webhooks: Webhook[] }>({ method: 'GET', path: '/api/v1/webhooks' }).then(
      (r) => r.webhooks ?? [],
    ) as Promise<Webhook[]>,
  createWebhook: (input: WebhookInput) =>
    request<Webhook>({ method: 'POST', path: '/api/v1/webhooks', body: input }),
  updateWebhook: (id: number, input: WebhookInput) =>
    request<Webhook>({ method: 'PUT', path: `/api/v1/webhooks/${id}`, body: input }),
  deleteWebhook: (id: number) =>
    request<{ id: number; deleted: boolean }>({ method: 'DELETE', path: `/api/v1/webhooks/${id}` }),
  testWebhook: (id: number) =>
    request<WebhookTestResult>({ method: 'POST', path: `/api/v1/webhooks/${id}/test` }),
  rotateWebhookSecret: (id: number) =>
    request<Webhook>({ method: 'POST', path: `/api/v1/webhooks/${id}/rotate-secret` }),

  // --- Security: dashboard token + API keys (admin tier) ------------------

  apiKeys: () =>
    request<{ api_keys: ApiKey[] }>({ method: 'GET', path: '/api/v1/security/api-keys' }).then(
      (r) => r.api_keys ?? [],
    ) as Promise<ApiKey[]>,
  createApiKey: (input: ApiKeyInput) =>
    request<ApiKey>({ method: 'POST', path: '/api/v1/security/api-keys', body: input }),
  revokeApiKey: (id: number) =>
    request<{ id: number; revoked: boolean }>({
      method: 'DELETE',
      path: `/api/v1/security/api-keys/${id}`,
    }),
  /** Set a custom dashboard token, or generate one when `token` is empty. */
  setToken: (token: string) =>
    request<TokenResponse>({ method: 'POST', path: '/api/v1/security/token', body: { token } }),
  /** Revoke the dashboard token (disable auth). */
  clearToken: () => request<TokenResponse>({ method: 'DELETE', path: '/api/v1/security/token' }),

  // --- Plugins (admin tier) -----------------------------------------------

  plugins: () => request<PluginsResponse>({ method: 'GET', path: '/api/v1/plugins' }),

  /** Enable a plugin; `netGrants` grants private/LAN access to declared hosts. */
  enablePlugin: (id: number, netGrants?: string[]) =>
    request<Plugin>({
      method: 'POST',
      path: `/api/v1/plugins/${id}/enable`,
      body: { net_grants: netGrants ?? [] },
    }),
  disablePlugin: (id: number) => request<Plugin>({ method: 'POST', path: `/api/v1/plugins/${id}/disable` }),
  reloadPlugin: (id: number) => request<Plugin>({ method: 'POST', path: `/api/v1/plugins/${id}/reload` }),
  uninstallPlugin: (id: number) =>
    request<UninstallResult>({ method: 'DELETE', path: `/api/v1/plugins/${id}` }),
  pluginEgress: (id: number, limit = 100) =>
    request<EgressResponse>({ method: 'GET', path: `/api/v1/plugins/${id}/egress`, query: { limit } }),

  // --- Plugin marketplace (registry) --------------------------------------

  pluginRegistry: () => request<RegistryResponse>({ method: 'GET', path: '/api/v1/plugins/registry' }),
  /** Install (or update) a plugin from the registry; it registers DISABLED. */
  installPlugin: (name: string) =>
    request<Plugin>({
      method: 'POST',
      path: `/api/v1/plugins/registry/${encodeURIComponent(name)}/install`,
    }),

  // --- Plugin pages (server-rendered; requirement #4) ---------------------

  pluginPages: () =>
    request<PluginPagesResponse>({ method: 'GET', path: '/api/v1/plugins/pages' }).then(
      (r) => r.pages ?? [],
    ),

  renderPluginPage: (name: string) =>
    request<PluginPageResponse>({
      method: 'GET',
      path: `/api/v1/plugins/pages/${encodeURIComponent(name)}`,
    }),

  /** Dispatch a page action/form; returns the refreshed page doc. */
  pluginPageAction: (name: string, id: string, params: Record<string, string>) =>
    request<PluginPageResponse>({
      method: 'POST',
      path: `/api/v1/plugins/pages/${encodeURIComponent(name)}/action`,
      body: { id, params },
    }),
};
