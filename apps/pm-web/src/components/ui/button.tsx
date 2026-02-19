"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-slate-900 !text-white shadow-sm hover:bg-slate-800",
        primary: "bg-blue-600 !text-white shadow-sm hover:bg-blue-700",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive !text-white shadow-sm hover:bg-destructive/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type MotionButtonProps = Omit<HTMLMotionProps<"button">, "children">;

export interface ButtonProps extends MotionButtonProps, VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
}

const defaultTransition: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 26,
  mass: 0.8,
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", whileHover, whileTap, transition, children, ...props }, ref) => {
    const disabled = props.disabled ?? false;

    return (
      <motion.button
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        whileHover={disabled ? undefined : whileHover ?? { y: -1, scale: 1.01 }}
        whileTap={disabled ? undefined : whileTap ?? { scale: 0.98 }}
        transition={transition ?? defaultTransition}
        {...props}
      >
        {children}
      </motion.button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
