/**
 * Typed kasas client for the renderer. Every call goes through `window.api.kasas`
 * (the main-process broker) — the renderer never touches the network directly,
 * which is how we sidestep kasas's lack of CORS.
 */

import type { KasasRequest } from '../../shared/ipc';
import type {
  Account,
  AccountsResponse,
  AuthStatus,
  Label,
  LabelsResponse,
  Organization,
  OrganizationsResponse,
  SearchResponse,
  SyncLog,
  SyncStatusResponse,
  Transaction,
  TransactionQuery,
  TransactionsResponse,
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

  syncStatus: () =>
    request<SyncStatusResponse>({ method: 'GET', path: '/api/v1/sync' }).then(
      (r) => r.latest,
    ) as Promise<SyncLog | null>,
};
