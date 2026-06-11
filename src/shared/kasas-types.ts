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
