import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

type CardProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: React.ReactNode;
};

function Card({ className, whileHover, whileTap, transition, ...props }: CardProps) {
  const isInteractive = props.onClick !== undefined || props.role === "button" || props.tabIndex !== undefined;

  return (
    <motion.div
      className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}
      whileHover={isInteractive ? (whileHover ?? { y: -2, scale: 1.005 }) : whileHover}
      whileTap={isInteractive ? (whileTap ?? { scale: 0.995 }) : whileTap}
      transition={transition ?? { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5 p-5", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold text-foreground", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
