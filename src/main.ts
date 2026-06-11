import { app, BrowserWindow, session, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpc, startBackend, stopBackend } from './main/ipc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// In dev, Forge injects this global with the Vite dev-server URL; in a packaged
// build it is undefined and we load the built renderer from disk.
const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;

function contentSecurityPolicy(): string {
  // The renderer never talks to kasas directly (all HTTP/SSE go through main via
  // IPC), so it needs no backend network access. We must allow inline *styles*
  // because Radix portals and Recharts inject inline `style` attributes. Dev also
  // needs inline/eval script + ws for Vite HMR and React Refresh; prod is strict.
  const script = isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'";
  const connect = isDev
    ? "connect-src 'self' ws: http://localhost:* http://127.0.0.1:*"
    : "connect-src 'self'";
  return [
    "default-src 'self'",
    script,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    connect,
  ].join('; ');
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b0f17',
    titleBarStyle: 'hiddenInset', // macOS: traffic lights over our chrome
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open target=_blank / external links in the user's browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.on('ready', async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy()],
      },
    });
  });

  await registerIpc();
  createWindow();
  void startBackend(); // spawn/managed-or-daemon; returns quickly, status streams in
  console.log('[sillview] main process ready, window created');
});

// Gracefully stop the managed kasas child before quitting (a background daemon
// is intentionally left running).
let backendStopped = false;
app.on('before-quit', (event) => {
  if (backendStopped) return;
  event.preventDefault();
  void stopBackend().finally(() => {
    backendStopped = true;
    app.quit();
  });
});

// On macOS, apps stay active until the user quits with Cmd+Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
