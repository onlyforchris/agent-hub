import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider, useAuth } from "./auth.tsx";
import { LoginPage } from "./LoginPage.tsx";

function RootApp() {
  const { loading, user } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-600">Loading session...</div>;
  }
  if (!user) return <LoginPage />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RootApp />
    </AuthProvider>
  </StrictMode>,
);
