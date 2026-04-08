import { useEffect, useState } from "react";
import { api } from "./api/client";
import { AuthPage } from "./pages/AuthPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { async function bootstrap() { try { if (!api.getToken()) { setLoading(false); return; } setUser(await api.me()); } catch { api.clearToken(); } finally { setLoading(false); } } bootstrap(); }, []);
  async function handleAuthenticated() { setUser(await api.me()); }
  function handleLogout() { api.clearToken(); setUser(null); }
  if (loading) return <div className="loading-screen">Loading dashboard...</div>;
  if (!user) return <AuthPage onAuthenticated={handleAuthenticated} />;
  return <WorkbenchPage user={user} onLogout={handleLogout} />;
}
