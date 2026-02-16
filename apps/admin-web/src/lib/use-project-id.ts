"use client";

import { useParams } from "next/navigation";

export function useProjectId(): string {
  const params = useParams<{ projectId: string }>();
  return params.projectId;
}
