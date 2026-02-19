"use client";

import { useState } from "react";
import { logout } from "@/lib/api";

export function AdminLogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        setSubmitting(true);
        await logout("/admin/login");
      }}
      disabled={submitting}
      className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
    >
      {submitting ? "로그?�웃 �?.." : "로그?�웃"}
    </button>
  );
}

