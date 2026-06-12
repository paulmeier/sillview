import { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { useConnection } from './store/connection';
import { useBackend } from './store/backend';
import { useDashboards } from './store/dashboards';
import { AppShell } from './shell/AppShell';
import { Spinner } from './components/ui';

function Splash() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0b0f17]">
      <Spinner className="size-6" />
    </div>
  );
}

export function App() {
  const hydrated = useDashboards((s) => s.hydrated);

  useEffect(() => {
    void useBackend.getState().init();
    void useConnection.getState().init();
    const finish = () => useDashboards.getState().finishHydration();
    if (useDashboards.persist.hasHydrated()) finish();
    return useDashboards.persist.onFinishHydration(finish);
  }, []);

  if (!hydrated) return <Splash />;

  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
