"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type FadeContentProps = React.HTMLAttributes<HTMLDivElement> & {
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let scrollerTarget: Element | string | null = container || document.getElementById("snap-main-container") || null;

    if (typeof scrollerTarget === "string") {
      scrollerTarget = document.querySelector(scrollerTarget);
    }

    const startPercent = (1 - threshold) * 100;

    gsap.set(element, {
      autoAlpha: initialOpacity,
      filter: blur ? "blur(8px)" : "blur(0px)",
      willChange: "opacity, filter, transform",
    });

    const timeline = gsap.timeline({
      paused: true,
      delay: toSeconds(delay),
      onComplete: () => {
        onComplete?.();
        if (disappearAfter > 0) {
          gsap.to(element, {
            autoAlpha: initialOpacity,
            filter: blur ? "blur(8px)" : "blur(0px)",
            delay: toSeconds(disappearAfter),
            duration: toSeconds(disappearDuration),
            ease: disappearEase,
            onComplete: () => onDisappearanceComplete?.(),
          });
        }
      },
    });

    timeline.to(element, {
      autoAlpha: 1,
      filter: "blur(0px)",
      duration: toSeconds(duration),
      ease,
    });

    const trigger = ScrollTrigger.create({
      trigger: element,
      scroller: scrollerTarget || window,
      start: `top ${startPercent}%`,
      once: true,
      onEnter: () => timeline.play(),
    });

    return () => {
      trigger.kill();
      timeline.kill();
      gsap.killTweensOf(element);
    };
  }, [
    blur,
    container,
    delay,
    disappearAfter,
    disappearDuration,
    disappearEase,
    duration,
    ease,
    initialOpacity,
    onComplete,
    onDisappearanceComplete,
    threshold,
  ]);

  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
}
