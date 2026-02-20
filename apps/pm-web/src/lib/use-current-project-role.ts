"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type ProjectRoleResponse = {
  role?: string | null;
};

export function useCurrentProjectRole(projectId: string | null | undefined) {
  const [loading, setLoading] = useState(true);
  const [projectRole, setProjectRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      if (!projectId) {
        if (!cancelled) {
          setProjectRole(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const me = await apiFetch<ProjectRoleResponse>(`/api/projects/${projectId}/my-role`);
        if (!cancelled) {
          setProjectRole(me.role ?? null);
        }
      } catch {
        if (!cancelled) {
          setProjectRole(null);
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
  }, [projectId]);

  return {
    loading,
    projectRole,
    isPmOwner: projectRole === "PM_OWNER",
  };
}
