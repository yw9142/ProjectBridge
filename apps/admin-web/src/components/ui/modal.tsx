"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
};

const BODY_MODAL_LOCK_COUNT_ATTR = "data-modal-lock-count";
const BODY_MODAL_ORIGINAL_OVERFLOW_ATTR = "data-modal-original-overflow";
const BODY_MODAL_ORIGINAL_PADDING_RIGHT_ATTR = "data-modal-original-padding-right";

function useBodyScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const body = document.body;
    const currentCount = Number(body.getAttribute(BODY_MODAL_LOCK_COUNT_ATTR) ?? "0");
    body.setAttribute(BODY_MODAL_LOCK_COUNT_ATTR, String(currentCount + 1));

    if (currentCount === 0) {
      body.setAttribute(BODY_MODAL_ORIGINAL_OVERFLOW_ATTR, body.style.overflow);
      body.setAttribute(BODY_MODAL_ORIGINAL_PADDING_RIGHT_ATTR, body.style.paddingRight);

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    return () => {
      const nextCount = Math.max(0, Number(body.getAttribute(BODY_MODAL_LOCK_COUNT_ATTR) ?? "1") - 1);
      if (nextCount > 0) {
        body.setAttribute(BODY_MODAL_LOCK_COUNT_ATTR, String(nextCount));
        return;
      }
      body.removeAttribute(BODY_MODAL_LOCK_COUNT_ATTR);
      body.style.overflow = body.getAttribute(BODY_MODAL_ORIGINAL_OVERFLOW_ATTR) ?? "";
      body.style.paddingRight = body.getAttribute(BODY_MODAL_ORIGINAL_PADDING_RIGHT_ATTR) ?? "";
      body.removeAttribute(BODY_MODAL_ORIGINAL_OVERFLOW_ATTR);
      body.removeAttribute(BODY_MODAL_ORIGINAL_PADDING_RIGHT_ATTR);
    };
  }, [open]);
}

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  useBodyScrollLock(open);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
              >
                닫기
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
