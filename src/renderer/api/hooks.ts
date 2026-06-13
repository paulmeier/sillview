/**
 * Small data-fetching layer. No react-query — a tiny useAsync plus resource hooks
 * keyed off the connection store's `version` (reconnect) and `eventNonce` (live
 * change events) so dashboards stay fresh without manual refresh wiring.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { kasas, KasasError } from './kasas';
import { useConnection } from '../store/connection';
import type { KasasEvent, MarketPointsResponse, TransactionQuery } from '../../shared/kasas-types';

const EMPTY_POINTS: MarketPointsResponse = { provider: '', as_of: '', fresh: false, points: [] };

export interface AsyncState<T> {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: React.DependencyList,
): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fnRef.current().then(
      (data) => !cancelled && setState({ data, loading: false }),
      (err: unknown) =>
        !cancelled &&
        setState({
          error: err instanceof Error ? err.message : String(err),
          loading: false,
        }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

/** Refetch keys. `live` adds the throttled event tick to the dependency list. */
function useKeys(live: boolean): unknown[] {
  const version = useConnection((s) => s.version);
  const eventNonce = useConnection((s) => s.eventNonce);
  return live ? [version, eventNonce] : [version];
}

/**
 * Refetch keys that re-run only when one of the named event families ticks
 * (plus on reconnect). Use this for pages that should refresh on, say,
 * `rule.*` or `plugin.*` events but not on every change event.
 */
export function useFamilyKeys(families: string[]): unknown[] {
  const version = useConnection((s) => s.version);
  const famSum = useConnection((s) =>
    families.reduce((sum, f) => sum + (s.familyNonces[f] ?? 0), 0),
  );
  return [version, famSum];
}

export function useOrganizations() {
  const keys = useKeys(false);
  return useAsync(() => kasas.organizations(), keys);
}

export function useAccounts(live = true) {
  const keys = useKeys(live);
  return useAsync(() => kasas.accounts(), keys);
}

export function useTransactions(query?: TransactionQuery, live = true) {
  const keys = useKeys(live);
  const queryKey = JSON.stringify(query ?? {});
  return useAsync(() => kasas.transactions(query), [...keys, queryKey]);
}

export function useLabels(live = false) {
  const keys = useKeys(live);
  return useAsync(() => kasas.labels(), keys);
}

export function useSyncStatus(live = true) {
  const keys = useKeys(live);
  return useAsync(() => kasas.syncStatus(), keys);
}

export interface LoggedEvent {
  /** Client-side arrival time (ms epoch) — events carry no reliable timestamp. */
  at: number;
  event: KasasEvent;
}

/** List configured market series (ADR 0006), with cache freshness. */
export function useMarketSeries(live = true) {
  const keys = useKeys(live);
  return useAsync(() => kasas.marketSeries(), keys);
}

/**
 * A market series' daily closes through the read-through cache. With live=true it
 * refetches when kasas emits events (a `market.updated` after a background refresh
 * ticks the event nonce), so a stale-then-fresh series updates on its own.
 */
export function useMarketPoints(id: string, since?: string, live = true) {
  const keys = useKeys(live);
  return useAsync(
    () => (id ? kasas.marketPoints(id, since) : Promise.resolve(EMPTY_POINTS)),
    [...keys, id, since],
  );
}

/**
 * Capability gate (ADR-0002): whether the connected kasas exposes /api/v1/market/*.
 * A backend predating market data answers {enabled:false} or 404; either way the
 * widget should degrade to a "requires a newer kasas" tile, not a broken chart.
 */
export function useMarketAvailable() {
  const keys = useKeys(false);
  const state = useAsync(async () => {
    try {
      const r = await kasas.marketSeries();
      return r.enabled === true;
    } catch (e) {
      // Only a 404 (route absent) is a definitive capability gap. Transient errors
      // (5xx, network, timeout) must NOT trip the "needs a newer kasas" tile — treat
      // the feature as present and let the widget's own fetch surface the error.
      if (e instanceof KasasError && e.status === 404) return false;
      return true;
    }
  }, keys);
  // `data === false` is the only definitive "unavailable"; undefined (loading) and
  // true both keep the widget on its normal path.
  return { available: state.data !== false, loading: state.loading };
}

/** Subscribe to the live kasas event stream; keeps the most recent `limit`. */
export function useEventLog(limit = 50): LoggedEvent[] {
  const [events, setEvents] = useState<LoggedEvent[]>([]);
  useEffect(() => {
    const unsubscribe = window.api.events.onEvent((e) => {
      setEvents((prev) => [{ at: Date.now(), event: e }, ...prev].slice(0, limit));
    });
    return unsubscribe;
  }, [limit]);
  return events;
}
