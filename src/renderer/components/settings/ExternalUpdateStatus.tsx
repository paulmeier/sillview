/**
 * Read-only kasas self-update status for EXTERNAL instances (GET /api/v1/update).
 * Bundled instances are updated by sillview itself (updater.ts), so this is only
 * shown when connecting to a remote kasas — sillview never drives its self-update.
 */

import { useEffect, useState } from 'react';
import { kasas } from '../../api/kasas';
import { Pill } from '../ui';
import type { KasasUpdateStatus } from '../../../shared/kasas-types';

export function ExternalUpdateStatus() {
  const [status, setStatus] = useState<KasasUpdateStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    kasas
      .updateStatus()
      .then(setStatus)
      .catch(() => setError(true));
  }, []);

  if (error || !status) return null;

  return (
    <div className="flex items-center gap-2 py-2 text-sm">
      <span className="text-slate-400">kasas {status.current}</span>
      {status.update_available ? (
        <Pill tone="blue">update available: {status.latest}</Pill>
      ) : (
        <Pill tone="green">up to date</Pill>
      )}
    </div>
  );
}
