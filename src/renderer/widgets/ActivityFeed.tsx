import { useEventLog } from '../api/hooks';
import { useConnection } from '../store/connection';
import { fromNow } from '../lib/time';
import { Pill, StatusDot } from '../components/ui';

function toneForEvent(type: string): 'green' | 'amber' | 'red' | 'blue' | 'neutral' {
  if (type.includes('delete') || type.includes('removed')) return 'red';
  if (type.includes('create') || type.includes('applied') || type.includes('added')) return 'green';
  if (type.includes('sync')) return 'blue';
  if (type.includes('update')) return 'amber';
  return 'neutral';
}

export function ActivityFeedWidget() {
  const events = useEventLog(60);
  const streamConnected = useConnection((s) => s.streamConnected);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        <StatusDot tone={streamConnected ? 'green' : 'neutral'} pulse={streamConnected} />
        <span>{streamConnected ? 'Live' : 'Disconnected'}</span>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-slate-500">
          {streamConnected ? 'Listening for changes…' : 'No live connection'}
        </div>
      ) : (
        <ul className="scroll-area min-h-0 flex-1 space-y-1.5">
          {events.map((e, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Pill tone={toneForEvent(e.event.type)}>{e.event.type}</Pill>
              <span className="ml-auto shrink-0 text-xs text-slate-500">
                {fromNow(new Date(e.at))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
