/**
 * Hosts a single plugin-contributed page at /ext/:name. Fetches the server-
 * rendered pageDoc, renders it, and dispatches actions/form submits back to the
 * plugin (adopting the refreshed doc). A hook error comes back as 502.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { kasas, KasasError } from '../api/kasas';
import { PageShell } from '../shell/Page';
import { PageRenderer } from '../components/plugin-page/PageRenderer';
import { Spinner } from '../components/ui';
import type { PluginPageDoc } from '../../shared/kasas-types';

export function PluginPage() {
  const { name = '' } = useParams();
  const [doc, setDoc] = useState<PluginPageDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await kasas.renderPluginPage(name);
      setDoc(res.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAction = async (id: string, params: Record<string, string>) => {
    setBusy(true);
    setError(undefined);
    try {
      const res = await kasas.pluginPageAction(name, id, params);
      setDoc(res.page);
    } catch (e) {
      setError(
        e instanceof KasasError && e.status === 502
          ? `The plugin's action handler errored: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title={doc?.title || name}>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner />
        </div>
      ) : error && !doc ? (
        <div className="text-sm text-rose-300/90">{error}</div>
      ) : doc ? (
        <div className="mx-auto max-w-3xl space-y-3">
          {error && <div className="text-sm text-rose-300/90">{error}</div>}
          <PageRenderer doc={doc} onAction={(id, p) => void onAction(id, p)} busy={busy} />
        </div>
      ) : (
        <div className="text-sm text-slate-500">This plugin page is empty.</div>
      )}
    </PageShell>
  );
}
