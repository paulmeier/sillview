/**
 * Shown when a setting change needs a kasas restart to take effect. In bundled
 * mode it restarts the managed process; in external mode it asks kasas to re-exec
 * (POST /system/restart) and waits for it to come back.
 */

import { useState } from 'react';
import { RiRestartLine } from '@remixicon/react';
import { kasas } from '../../api/kasas';
import { useBackend } from '../../store/backend';
import { useConnection } from '../../store/connection';
import { Button } from '../ui';
import { cx } from '../../lib/utils';
import { waitForBackend } from './restart';

export function RestartBanner({
  show,
  onRestarted,
}: {
  show: boolean;
  onRestarted: () => void | Promise<void>;
}) {
  const mode = useBackend((s) => s.settings?.mode ?? 'bundled');
  const restartBundled = useBackend((s) => s.restart);
  const [restarting, setRestarting] = useState(false);

  if (!show) return null;

  const onRestart = async () => {
    setRestarting(true);
    try {
      if (mode === 'bundled') {
        await restartBundled();
      } else {
        await kasas.restart();
        await waitForBackend();
        await useConnection.getState().refresh();
      }
      await onRestarted();
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="text-sm text-amber-200">Some changes take effect after a restart.</div>
      <Button variant="primary" onClick={() => void onRestart()} disabled={restarting}>
        <RiRestartLine className={cx('size-4', restarting && 'animate-spin')} />
        {restarting ? 'Restarting…' : 'Restart kasas'}
      </Button>
    </div>
  );
}
