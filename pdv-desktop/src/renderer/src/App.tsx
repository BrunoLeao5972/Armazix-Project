import { useEffect } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { restoreToken } from "./services/auth.service";
import { startNetworkMonitor } from "./services/network.service";
import { watchConnectionAndDrain } from "./services/sync.service";
import { LoginScreen } from "./screens/LoginScreen";
import { PdvScreen } from "./screens/PdvScreen";

function Shell() {
  const { session } = useAuth();
  return session ? <PdvScreen /> : <LoginScreen />;
}

export default function App() {
  useEffect(() => {
    restoreToken();
    const stopNetworkMonitor = startNetworkMonitor();
    const stopDrainWatcher = watchConnectionAndDrain();
    return () => {
      stopNetworkMonitor();
      stopDrainWatcher();
    };
  }, []);

  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
