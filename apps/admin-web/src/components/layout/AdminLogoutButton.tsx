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
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
    >
      {submitting ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
