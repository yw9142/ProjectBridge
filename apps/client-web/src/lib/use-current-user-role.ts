"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type AuthMeResponse = {
  isPlatformAdmin: boolean;
  tenantRole?: string | null;
};

export function useCurrentUserRole() {
  const [loading, setLoading] = useState(true);
  const [tenantRole, setTenantRole] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      setLoading(true);
      try {
        const me = await apiFetch<AuthMeResponse>("/api/auth/me");
        if (!cancelled) {
          setTenantRole(me.tenantRole ?? null);
          setIsPlatformAdmin(Boolean(me.isPlatformAdmin));
        }
      } catch {
        if (!cancelled) {
          setTenantRole(null);
          setIsPlatformAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, tenantRole, isPlatformAdmin };
}
