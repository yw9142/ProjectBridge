"use client";

import { useState } from "react";
import { logout } from "@/lib/api";
import { ConfirmActionButton } from "@/components/ui/confirm-action";

export function PmLogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <ConfirmActionButton
      label={submitting ? "ë¡œê·¸?„ì›ƒ ì¤?.." : "ë¡œê·¸?„ì›ƒ"}
      title="ë¡œê·¸?„ì›ƒ? ê¹Œ??"
      description="?„ìž¬ ?¸ì…˜??ì¢…ë£Œ?˜ê³  ë¡œê·¸???˜ì´ì§€ë¡??´ë™?©ë‹ˆ??"
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

