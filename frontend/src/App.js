import React, { useEffect, useState } from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import AuroraBackground from "@/components/AuroraBackground";
import SplashScreen from "@/components/SplashScreen";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Tasks from "@/pages/Tasks";
import Routines from "@/pages/Routines";
import Loans from "@/pages/Loans";
import CashFlow from "@/pages/CashFlow";
import Investments from "@/pages/Investments";
import Notes from "@/pages/Notes";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function Root() {
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 1500);
    return () => clearTimeout(t);
  }, []);
  if (booting) return <SplashScreen />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="routines" element={<Routines />} />
        <Route path="loans" element={<Loans />} />
        <Route path="cash-flow" element={<CashFlow />} />
        <Route path="investments" element={<Investments />} />
        <Route path="notes" element={<Notes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App mm-font-body text-white">
      <AuroraBackground />
      <AuthProvider>
        <BrowserRouter>
          <Root />
        </BrowserRouter>
      </AuthProvider>
      <Toaster
        theme="dark"
        position="bottom-left"
        offset={24}
        toastOptions={{
          style: {
            background: "rgba(20,20,22,0.85)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
            backdropFilter: "blur(16px)",
          },
        }}
      />
    </div>
  );
}

export default App;
