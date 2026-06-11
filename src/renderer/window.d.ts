import type { SillviewApi } from '../shared/ipc';

declare global {
  interface Window {
    /** The bridge to the main process, exposed by the preload. */
    api: SillviewApi;
  }
}

export {};
