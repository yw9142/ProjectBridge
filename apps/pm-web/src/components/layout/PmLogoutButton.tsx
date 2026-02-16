"use client";

import { useState } from "react";
import { logout } from "@/lib/api";
import { ConfirmActionButton } from "@/components/ui/confirm-action";

export function PmLogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <ConfirmActionButton
      label={submitting ? "로그아웃 중..." : "로그아웃"}
      title="로그아웃할까요?"
      description="현재 세션이 종료되고 로그인 페이지로 이동합니다."
      disabled={submitting}
      onConfirm={async () => {
        setSubmitting(true);
        await logout("/login");
      }}
      triggerVariant="outline"
      triggerSize="sm"
    />
  );
}
