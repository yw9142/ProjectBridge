"use client";

import * as React from "react";
import { useEffect, useRef } from "react";

type MagnetProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  padding?: number;
  disabled?: boolean;
  magnetStrength?: number;
  activeTransition?: string;
  inactiveTransition?: string;
  wrapperClassName?: string;
  innerClassName?: string;
};

export default function Magnet({
  children,
  padding = 100,
  disabled = false,
  magnetStrength = 2,
  activeTransition = "transform 0.3s ease-out",
  inactiveTransition = "transform 0.5s ease-in-out",
  wrapperClassName = "",
  innerClassName = "",
  ...props
}: MagnetProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) {
      return;
    }

    const reset = () => {
      inner.style.transform = "translate3d(0px, 0px, 0)";
      inner.style.transition = inactiveTransition;
    };

    if (disabled) {
      reset();
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const { left, top, width, height } = wrapper.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;

      const distX = Math.abs(centerX - event.clientX);
      const distY = Math.abs(centerY - event.clientY);

      if (distX < width / 2 + padding && distY < height / 2 + padding) {
        const offsetX = (event.clientX - centerX) / magnetStrength;
        const offsetY = (event.clientY - centerY) / magnetStrength;
        inner.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
        inner.style.transition = activeTransition;
      } else {
        reset();
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      reset();
    };
  }, [activeTransition, disabled, inactiveTransition, magnetStrength, padding]);

  return (
    <div
      ref={wrapperRef}
      className={wrapperClassName}
      style={{ position: "relative", display: "inline-block" }}
      {...props}
    >
      <div ref={innerRef} className={innerClassName} style={{ willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
}
