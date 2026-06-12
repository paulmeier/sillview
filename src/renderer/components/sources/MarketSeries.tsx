/**
 * The market source's series manager: define and remove the symbols kasas fetches
 * (benchmark indices, fund NAVs, FX, crypto). The provider API key itself is set
 * via the generic CredentialForm — this is the market-specific extra that a normal
 * source doesn't have. Rendered on the market source's detail page.
 */

import { useState } from 'react';
import { kasas } from '../../api/kasas';
import { useMarketSeries } from '../../api/hooks';
import { Button } from '../ui';
import type { MarketKind } from '../../../shared/kasas-types';

const KINDS: MarketKind[] = ['equity', 'fund', 'index', 'fx', 'crypto'];
const inputCls =
  'rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500';

export function MarketSeries() {
  const list = useMarketSeries(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [id, setId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [kind, setKind] = useState<MarketKind>('equity');
  const [currency, setCurrency] = useState('USD');
  const [name, setName] = useState('');

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
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
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
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const data = list.data;

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-slate-400">Series</div>
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
              <button className="text-slate-400 hover:text-rose-300" title="Remove" onClick={() => void removeSeries(s.id)} disabled={busy}>
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

      {msg && <div className={msg.ok ? 'mt-2 text-xs text-emerald-400' : 'mt-2 text-xs text-rose-300'}>{msg.text}</div>}
    </div>
  );
}
