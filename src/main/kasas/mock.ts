/**
 * In-memory kasas fixtures for offline UI development.
 *
 * Enabled with `KASAS_MOCK=1` (see `npm run start:mock`). When the flag is set,
 * the main process answers every brokered REST call from these fixtures instead
 * of fetching kasas, skips spawning the managed binary, and feeds the SSE stream
 * synthetic events. Nothing here runs in a normal launch — the flag is off by
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
  AuthStatus,
  KasasEvent,
  Label,
  Organization,
  SyncLog,
  Transaction,
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
  // Recurring charges can land a few days into the current month — never emit a
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
  addTxn('acc_checking', 4187.34, p, 'Initech Payroll', 'income', { description: 'Direct deposit — payroll' });
}

// A few crypto buys to exercise 8-dp money formatting.
for (let k = 0; k < 4; k++) {
  addTxn('acc_btc', between(-0.015, -0.004), now - (20 + k * 35) * DAY, 'Coinbase', 'investing', {
    description: 'BTC purchase',
    scale: 8,
    source: 'manual',
  });
}

/** Newest first — every list/search endpoint serves from this order. */
const sortedTxns = [...transactions].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

// --- Labels (derived from the transaction categories) -----------------------

const labelCounts = new Map<string, number>();
for (const t of transactions) {
  const v = t.labels.category;
  if (v) labelCounts.set(v, (labelCounts.get(v) ?? 0) + 1);
}
const labels: Label[] = [...labelCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([value, transaction_count]) => ({ key: 'category', value, transaction_count }));

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
  let list = sortedTxns;
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

const ok = (data: unknown): KasasResult => ({ ok: true, status: 200, data });

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

  if (path === '/api/v1/labels') return ok({ labels });
  if (path === '/api/v1/sync') return ok({ latest: syncLog });

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
