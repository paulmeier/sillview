/**
 * A source's credential editor: paste-and-connect, multi-credential add/remove,
 * or a browser OAuth handoff — driven entirely by the kasas source descriptor.
 * Shared by every source's detail page (the market source's API key flows through
 * here too, since it's just a single credential).
 */

import { useState } from 'react';
import { RiCloseLine, RiExternalLinkLine } from '@remixicon/react';
import { kasas } from '../../api/kasas';
import { Button } from '../ui';
import type { SourceDTO } from '../../../shared/kasas-types';

const inputClass =
  'w-full rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/60 focus:outline-none';

export function CredentialForm({
  source,
  onChanged,
}: {
  source: SourceDTO;
  onChanged: () => Promise<void>;
}) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!source.credentialed && !source.oauth) return null;

  const submit = async () => {
    if (!token.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await kasas.setSourceCredential(source.type, token.trim());
      setToken('');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await kasas.removeSourceCredential(source.type, id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const oauth = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const { url } = await kasas.sourceOAuthStart(source.type);
      await window.api.system.openExternal(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const fieldTitle = source.credentials?.[0]?.title ?? 'Credential';
  const fieldHelp = source.credentials?.[0]?.help;

  return (
    <div className="space-y-2">
      {source.multi_credential && source.credential_entries && source.credential_entries.length > 0 && (
        <div className="space-y-1">
          {source.credential_entries.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm text-slate-300">
              <span className="font-mono">{c.label}</span>
              {c.removable && (
                <button
                  className="text-slate-500 hover:text-rose-300"
                  disabled={busy}
                  onClick={() => void remove(c.id)}
                  title="Remove"
                >
                  <RiCloseLine className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {source.credentialed && (
        <div>
          <div className="mb-1 text-xs font-medium text-slate-400">
            {source.multi_credential ? `Add ${fieldTitle.toLowerCase()}` : fieldTitle}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
              placeholder="Paste credential…"
              className={inputClass}
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
            <Button variant="primary" onClick={() => void submit()} disabled={busy || !token.trim()}>
              {source.multi_credential ? 'Add' : 'Connect'}
            </Button>
          </div>
          {fieldHelp && <div className="mt-1 text-xs text-slate-500">{fieldHelp}</div>}
        </div>
      )}

      {source.oauth && (
        <Button variant="subtle" onClick={() => void oauth()} disabled={busy}>
          <RiExternalLinkLine className="size-4" />
          Connect with browser
        </Button>
      )}

      {error && <div className="text-xs text-rose-300/90">{error}</div>}
    </div>
  );
}
