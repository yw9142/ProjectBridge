"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

type ConfirmCommonProps = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  disabled?: boolean;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  confirmVariant?: ButtonProps["variant"];
};

type ConfirmActionButtonProps = ConfirmCommonProps & {
  label: React.ReactNode;
  onConfirm: () => void | Promise<void>;
};

type ConfirmSubmitButtonProps = ConfirmCommonProps & {
  label: React.ReactNode;
};

export function ConfirmActionButton({
  label,
  title,
  description,
  confirmText = "?뺤씤",
  cancelText = "痍⑥냼",
  disabled,
  onConfirm,
  triggerVariant = "default",
  triggerSize = "default",
  triggerClassName,
  confirmVariant = "primary",
}: ConfirmActionButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize} className={triggerClassName} disabled={disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">{cancelText}</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={confirmVariant}
              onClick={() => {
                void onConfirm();
              }}
            >
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ConfirmSubmitButton({
  label,
  title,
  description,
  confirmText = "?뺤씤",
  cancelText = "痍⑥냼",
  disabled,
  triggerVariant = "primary",
  triggerSize = "default",
  triggerClassName,
  confirmVariant = "primary",
}: ConfirmSubmitButtonProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button ref={triggerRef} type="button" variant={triggerVariant} size={triggerSize} className={triggerClassName} disabled={disabled}>
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline">{cancelText}</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={confirmVariant}
              onClick={() => {
                triggerRef.current?.form?.requestSubmit();
              }}
            >
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

