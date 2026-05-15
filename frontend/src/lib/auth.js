import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem("mm_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("mm_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("mm_token", data.token);
    setUser(data.user);
    // First-login auto-seed (idempotent — server returns seeded:false if data exists)
    try { await api.post("/seed/first-login", {}); } catch { /* */ }
    return data.user;
  }, []);

  const signup = useCallback(async (first_name, email, password) => {
    const { data } = await api.post("/auth/signup", { first_name, email, password });
    localStorage.setItem("mm_token", data.token);
    setUser(data.user);
    try { await api.post("/seed/first-login", {}); } catch { /* */ }
    return data.user;
  }, []);

  const demoLogin = useCallback(async (first_name) => {
    const { data } = await api.post("/auth/demo-login", { first_name });
    localStorage.setItem("mm_token", data.token);
    setUser(data.user);
    try { await api.post("/seed/first-login", {}); } catch { /* */ }
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("mm_token");
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, signup, demoLogin, logout, refresh: bootstrap }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
