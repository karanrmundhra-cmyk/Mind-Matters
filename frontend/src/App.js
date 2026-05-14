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
import CashFlow from "@/pages/CashFlow";
import Notes from "@/pages/Notes";
import Reminders from "@/pages/Reminders";
import Calendar from "@/pages/Calendar";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";

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
        <Route path="cash-flow" element={<CashFlow />} />
        <Route path="cashflow" element={<Navigate to="/cash-flow" replace />} />
        <Route path="notes" element={<Notes />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        {/* v2 removed pages — redirect to dashboard */}
        <Route path="loans" element={<Navigate to="/cash-flow" replace />} />
        <Route path="investments" element={<Navigate to="/cash-flow" replace />} />
        <Route path="invoices" element={<Navigate to="/" replace />} />
        <Route path="documents" element={<Navigate to="/" replace />} />
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
            background: "linear-gradient(180deg, rgba(26,21,10,0.95), rgba(14,13,10,0.95))",
            border: "1px solid rgba(201,169,97,0.35)",
            color: "#E4C98C",
            backdropFilter: "blur(16px)",
          },
        }}
      />
    </div>
  );
}

export default App;
