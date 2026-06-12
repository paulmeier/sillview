/**
 * Discovers plugin-contributed pages (GET /api/v1/plugins/pages) and re-fetches
 * on reconnect and on plugin.* events (so enabling/disabling a plugin updates the
 * sidebar). Returns the page list for the dynamic "Plugin Pages" nav group.
 */

import { useEffect, useState } from 'react';
import { kasas } from '../api/kasas';
import { useConnection } from '../store/connection';
import type { PluginPageInfo } from '../../shared/kasas-types';

export function usePluginPages(): PluginPageInfo[] {
  const version = useConnection((s) => s.version);
  const pluginNonce = useConnection((s) => s.familyNonces['plugin'] ?? 0);
  const [pages, setPages] = useState<PluginPageInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    kasas
      .pluginPages()
      .then((p) => !cancelled && setPages(p))
      .catch(() => !cancelled && setPages([]));
    return () => {
      cancelled = true;
    };
  }, [version, pluginNonce]);

  return pages;
}
