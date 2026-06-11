import type { Account } from '../../shared/kasas-types';

/** The currency used by the most accounts — what mixed-currency widgets show. */
export function dominantCurrency(accounts: Account[]): string | null {
  const counts = new Map<string, number>();
  for (const a of accounts) counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1);
  let best: string | null = null;
  let bestN = -1;
  for (const [cur, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = cur;
    }
  }
  return best;
}

/** account id -> currency, for resolving a transaction's currency. */
export function accountCurrencyMap(accounts: Account[]): Map<string, string> {
  return new Map(accounts.map((a) => [a.id, a.currency]));
}
