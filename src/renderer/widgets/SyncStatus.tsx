import { useSyncStatus } from '../api/hooks';
import { useConnection } from '../store/connection';
import { fromNow } from '../lib/time';
import { Pill, StatusDot, WidgetState } from '../components/ui';

function syncTone(status: string): 'green' | 'amber' | 'red' | 'neutral' {
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('success') || s.includes('ok')) return 'green';
  if (s.includes('run') || s.includes('progress') || s.includes('pending')) return 'amber';
  if (s.includes('fail') || s.includes('error')) return 'red';
  return 'neutral';
}

export function SyncStatusWidget() {
  const { data: sync, loading, error } = useSyncStatus();
  const status = useConnection((s) => s.status);
  const streamConnected = useConnection((s) => s.streamConnected);

  if (loading || error) return <WidgetState loading={loading} error={error} />;

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="flex items-center gap-2">
        <StatusDot
          tone={status === 'online' ? 'green' : status === 'offline' ? 'red' : 'neutral'}
        />
        <span className="text-sm text-slate-300">
          Backend {status === 'online' ? 'connected' : status}
        </span>
        <Pill tone={streamConnected ? 'green' : 'neutral'} className="ml-auto">
          {streamConnected ? 'live' : 'idle'}
        </Pill>
      </div>

      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Last sync
        </div>
        {sync ? (
          <div className="mt-1 flex items-center gap-2">
            <Pill tone={syncTone(sync.status)}>{sync.status}</Pill>
            <span className="text-sm text-slate-400">
              {fromNow(sync.completed_at ?? sync.started_at)}
            </span>
          </div>
        ) : (
          <div className="mt-1 text-sm text-slate-500">No sync recorded</div>
        )}
      </div>
    </div>
  );
}
