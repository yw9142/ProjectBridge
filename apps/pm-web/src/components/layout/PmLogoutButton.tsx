"use client";

import { useState } from "react";
import { logout } from "@/lib/api";
import { ConfirmActionButton } from "@/components/ui/confirm-action";

export function PmLogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <ConfirmActionButton
      label={submitting ? "濡쒓렇?꾩썐 以?.." : "濡쒓렇?꾩썐"}
      title="濡쒓렇?꾩썐?좉퉴??"
      description="?꾩옱 ?몄뀡??醫낅즺?섍퀬 濡쒓렇???섏씠吏濡??대룞?⑸땲??"
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

