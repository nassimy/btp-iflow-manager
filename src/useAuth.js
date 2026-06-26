// useAuth.js — fetches /api/me and exposes role booleans
import { useState, useEffect } from "react";

export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => setUser(data))
      .catch(() => setUser({ name: "Unknown", email: null, scopes: [] }))
      .finally(() => setLoading(false));
  }, []);

  const scopes = user?.scopes || [];

  // Helper: check if any of the scopes ends with the given suffix
  const has = (suffix) => scopes.some((s) => s.endsWith(`.${suffix}`));

  return {
    user,
    authLoading: loading,
    canView:   has("view"),
    canDeploy: has("deploy"),
    canManage: has("manage"),
  };
}
