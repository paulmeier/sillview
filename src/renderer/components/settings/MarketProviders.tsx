import { useState } from 'react';
import { kasas, KasasError } from '../../api/kasas';
import { useMarketSeries } from '../../api/hooks';
import { Button } from '../ui';
import type { MarketKind } from '../../../shared/kasas-types';

const KINDS: MarketKind[] = ['equity', 'fund', 'index', 'fx', 'crypto'];

/**
 * Market-data provider settings (sillview ADR-0004): set the provider API key and
 * define/remove the series kasas fetches. These flow through kasas's admin-tier
 * source-credential and market endpoints — the same path bank credentials use — so
 * they work identically for the bundled backend and a remote kasas. A connection
 * holding only a read-only API key gets a 403, surfaced as a read-only notice.
 */
export function MarketProviders() {
  const list = useMarketSeries(false);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Define-series form.
  const [id, setId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [kind, setKind] = useState<MarketKind>('equity');
  const [currency, setCurrency] = useState('USD');
  const [name, setName] = useState('');

  const report = (e: unknown) => {
    if (e instanceof KasasError && e.status === 403) {
      setMsg({ ok: false, text: 'This connection is read-only — provider settings need the dashboard token.' });
    } else {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const saveKey = async () => {
    if (!key.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await kasas.setSourceCredential('market', key.trim());
      setKey('');
      setMsg({ ok: true, text: 'Provider key saved.' });
      list.reload();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };

  const addSeries = async () => {
    if (!id.trim() || !symbol.trim()) {
      setMsg({ ok: false, text: 'An id and a symbol are required.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await kasas.addMarketSeries({ id: id.trim(), symbol: symbol.trim(), kind, currency: currency.trim(), name: name.trim() });
      setId('');
      setSymbol('');
      setName('');
      setMsg({ ok: true, text: 'Series added.' });
      list.reload();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };

  const removeSeries = async (seriesId: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await kasas.removeMarketSeries(seriesId);
      list.reload();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };

  const data = list.data;
  const inputCls = 'rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500';

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <div className="mb-1 font-medium text-slate-200">Provider</div>
        <p className="mb-2 text-xs text-slate-400">
          kasas fetches benchmark indices, fund NAVs, FX & crypto on demand and caches them. The key is stored on
          the server (a free Alpha Vantage key works:{' '}
          <span className="text-slate-300">alphavantage.co/support/#api-key</span>).
          {data ? (
            <>
              {' '}
              Active provider: <span className="text-slate-300">{data.provider}</span> ·{' '}
              <span className={data.configured ? 'text-emerald-400' : 'text-amber-400'}>
                {data.configured ? 'connected' : 'no key set'}
              </span>
              .
            </>
          ) : null}
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            className={`${inputCls} flex-1`}
            placeholder="Paste provider API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Button onClick={saveKey} disabled={busy || !key.trim()}>
            Save key
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-1 font-medium text-slate-200">Series</div>
        {data && data.series.length > 0 ? (
          <ul className="mb-3 flex flex-col gap-1">
            {data.series.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1">
                <span className="font-mono text-xs text-slate-300">{s.id}</span>
                <span className="text-xs text-slate-400">
                  {s.symbol} · {s.kind} · {s.currency}
                  {s.adjusted ? ' · adjusted' : ''}
                </span>
                <span className="ml-auto text-[11px] text-slate-500">{s.as_of ? `as of ${s.as_of}` : 'never fetched'}</span>
                <button className="text-slate-400 hover:text-rose-300" title="Remove" onClick={() => removeSeries(s.id)} disabled={busy}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-xs text-slate-500">No series configured yet.</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="id (e.g. spy)" value={id} onChange={(e) => setId(e.target.value)} />
          <input className={inputCls} placeholder="symbol (SPY, EUR/USD, BTC)" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as MarketKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input className={inputCls} placeholder="currency (USD)" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <input className={`${inputCls} col-span-2`} placeholder="name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="mt-2">
          <Button onClick={addSeries} disabled={busy}>
            Add series
          </Button>
        </div>
      </div>

      {msg && <div className={msg.ok ? 'text-xs text-emerald-400' : 'text-xs text-rose-300'}>{msg.text}</div>}
    </div>
  );
}
