/**
 * Small data-fetching layer. No react-query — a tiny useAsync plus resource hooks
 * keyed off the connection store's `version` (reconnect) and `eventNonce` (live
 * change events) so dashboards stay fresh without manual refresh wiring.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { kasas } from './kasas';
import { useConnection } from '../store/connection';
import type { KasasEvent } from '../../shared/kasas-types';
import type { TransactionQuery } from '../../shared/kasas-types';

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
