"use client";

import * as React from "react";
import { motion, type HTMLMotionProps, type Transition } from "motion/react";

type FadeContentProps = Omit<HTMLMotionProps<"div">, "children" | "transition" | "onAnimationComplete"> & {
  children: React.ReactNode;
  container?: Element | string | null;
  blur?: boolean;
  duration?: number;
  ease?: string;
  delay?: number;
  threshold?: number;
  initialOpacity?: number;
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
};

const toSeconds = (value: number) => (value > 10 ? value / 1000 : value);
const clampThreshold = (value: number) => Math.min(Math.max(value, 0), 1);

type MotionEase = NonNullable<Transition["ease"]>;

const EASE_PRESETS: Record<string, MotionEase> = {
  "power2.out": [0.22, 1, 0.36, 1],
  "power2.in": [0.55, 0, 1, 0.45],
  "power2.inOut": [0.45, 0, 0.55, 1],
  linear: "linear",
  ease: "easeInOut",
};

const resolveEase = (value: string, fallback: MotionEase): MotionEase => {
  return EASE_PRESETS[value] ?? fallback;
};

export default function FadeContent({
  children,
  container,
  blur = false,
  duration = 700,
  ease = "power2.out",
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = "power2.in",
  onComplete,
  onDisappearanceComplete,
  className = "",
  ...props
}: FadeContentProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const [shouldDisappear, setShouldDisappear] = React.useState(false);
  const hasEnteredViewRef = React.useRef(false);
  const hasFadeInCompletedRef = React.useRef(false);
  const hasFadeOutCompletedRef = React.useRef(false);

  const hiddenState = React.useMemo(
    () => ({
      opacity: initialOpacity,
      filter: blur ? "blur(8px)" : "blur(0px)",
    }),
    [blur, initialOpacity],
  );

  const visibleState = React.useMemo(
    () => ({
      opacity: 1,
      filter: "blur(0px)",
    }),
    [],
  );

  const transition = React.useMemo<Transition>(() => {
    if (isVisible) {
      return {
        duration: toSeconds(duration),
        delay: toSeconds(delay),
        ease: resolveEase(ease, [0.22, 1, 0.36, 1]),
      };
    }

    return {
      duration: toSeconds(disappearDuration),
      ease: resolveEase(disappearEase, [0.55, 0, 1, 0.45]),
    };
  }, [delay, disappearDuration, disappearEase, duration, ease, isVisible]);

  const resolveContainer = React.useCallback((): Element | null => {
    let scrollerTarget: Element | string | null = container || document.getElementById("snap-main-container") || null;

    if (typeof scrollerTarget === "string") {
      scrollerTarget = document.querySelector(scrollerTarget);
    }

    return scrollerTarget ?? null;
  }, [container]);

  React.useEffect(() => {
    if (hasEnteredViewRef.current) {
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          hasEnteredViewRef.current = true;
          setIsVisible(true);
          observer.disconnect();
          break;
        }
      },
      {
        root: resolveContainer(),
        threshold: clampThreshold(threshold),
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [resolveContainer, threshold]);

  React.useEffect(() => {
    if (!shouldDisappear) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsVisible(false);
    }, toSeconds(disappearAfter) * 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [disappearAfter, shouldDisappear]);

  const handleAnimationComplete = React.useCallback(() => {
    if (isVisible) {
      if (!hasFadeInCompletedRef.current) {
        hasFadeInCompletedRef.current = true;
        onComplete?.();
        if (disappearAfter > 0) {
          setShouldDisappear(true);
        }
      }
      return;
    }

    if (hasFadeInCompletedRef.current && !hasFadeOutCompletedRef.current) {
      hasFadeOutCompletedRef.current = true;
      onDisappearanceComplete?.();
    }
  }, [disappearAfter, isVisible, onComplete, onDisappearanceComplete]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ willChange: "opacity, filter, transform", ...props.style }}
      initial={hiddenState}
      animate={isVisible ? visibleState : hiddenState}
      transition={transition}
      onAnimationComplete={handleAnimationComplete}
      {...props}
    >
      {children}
    </motion.div>
  );
}
