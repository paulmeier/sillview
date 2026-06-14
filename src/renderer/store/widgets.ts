/**
 * Widget marketplace store. Unlike the dashboards store this is NOT persisted —
 * the source of truth is the main process (installed-widgets.json + the fetched
 * registry), reached over the `window.api.widgets` IPC surface. The store holds the
 * fetched registry, the installed list, and the marketplace search/filter UI state,
 * and re-reads the installed list when an external writer (the MCP server) changes
 * it.
 */

import { create } from 'zustand';
import type { InstalledWidget, RegistryWidget } from '../../shared/widget-registry';

interface WidgetsState {
  registry: RegistryWidget[];
  installed: InstalledWidget[];
  loadingRegistry: boolean;
  loadingInstalled: boolean;
  /** Registry unreachable / unsupported, surfaced on the marketplace page. */
  registryError?: string;
  /** Whether the initial load + onChange subscription has run. */
  ready: boolean;

  init: () => void;
  loadRegistry: (force?: boolean) => Promise<void>;
  loadInstalled: () => Promise<void>;
  install: (slug: string) => Promise<void>;
  uninstall: (slug: string) => Promise<void>;
}

export const useWidgets = create<WidgetsState>((set, get) => ({
  registry: [],
  installed: [],
  loadingRegistry: false,
  loadingInstalled: false,
  registryError: undefined,
  ready: false,

  init: () => {
    if (get().ready) return;
    set({ ready: true });
    void get().loadInstalled();
    void get().loadRegistry();
    // Re-read installed widgets when the MCP server installs/uninstalls externally.
    window.api.widgets.onChange(() => void get().loadInstalled());
  },

  loadRegistry: async (force) => {
    set({ loadingRegistry: true });
    const res = await window.api.widgets.registry(force);
    set({
      registry: res.ok && res.index ? res.index.widgets : [],
      registryError: res.ok ? undefined : (res.error ?? 'The widget registry is unreachable.'),
      loadingRegistry: false,
    });
  },

  loadInstalled: async () => {
    set({ loadingInstalled: true });
    const installed = await window.api.widgets.installed();
    set({ installed, loadingInstalled: false });
  },

  install: async (slug) => {
    const installed = await window.api.widgets.install(slug);
    set({ installed });
  },

  uninstall: async (slug) => {
    const installed = await window.api.widgets.uninstall(slug);
    set({ installed });
  },
}));

/** A Set of installed widget slugs, for membership checks. */
export function useInstalledSlugs(): Set<string> {
  return useWidgets((s) => new Set(s.installed.map((w) => w.slug)));
}

/** A Set of installed widget *types*, for gating the Add-widget panel. */
export function useInstalledTypes(): Set<string> {
  return useWidgets((s) => new Set(s.installed.map((w) => w.widget_type)));
}
