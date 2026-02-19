"use client";

import * as React from "react";
import { useRef } from "react";

type GlareHoverProps = {
  width?: string;
  height?: string;
  background?: string;
  borderRadius?: string;
  borderColor?: string;
  children?: React.ReactNode;
  glareColor?: string;
  glareOpacity?: number;
  glareAngle?: number;
  glareSize?: number;
  transitionDuration?: number;
  playOnce?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export default function GlareHover({
  width = "100%",
  height = "100%",
  background = "transparent",
  borderRadius = "12px",
  borderColor = "transparent",
  children,
  glareColor = "#ffffff",
  glareOpacity = 0.4,
  glareAngle = -45,
  glareSize = 250,
  transitionDuration = 650,
  playOnce = false,
  className = "",
  style = {},
}: GlareHoverProps) {
  const hex = glareColor.replace("#", "");
  let rgba = glareColor;
  if (/^[\dA-Fa-f]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    rgba = `rgba(${r}, ${g}, ${b}, ${glareOpacity})`;
  } else if (/^[\dA-Fa-f]{3}$/.test(hex)) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    rgba = `rgba(${r}, ${g}, ${b}, ${glareOpacity})`;
  }

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const animateIn = () => {
    const element = overlayRef.current;
    if (!element) {
      return;
    }

    element.style.transition = "none";
    element.style.backgroundPosition = "-100% -100%, 0 0";
    element.style.transition = `${transitionDuration}ms ease`;
    element.style.backgroundPosition = "100% 100%, 0 0";
  };

  const animateOut = () => {
    const element = overlayRef.current;
    if (!element) {
      return;
    }

    if (playOnce) {
      element.style.transition = "none";
      element.style.backgroundPosition = "-100% -100%, 0 0";
    } else {
      element.style.transition = `${transitionDuration}ms ease`;
      element.style.backgroundPosition = "-100% -100%, 0 0";
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: `linear-gradient(${glareAngle}deg, hsla(0,0%,0%,0) 60%, ${rgba} 70%, hsla(0,0%,0%,0) 100%)`,
    backgroundSize: `${glareSize}% ${glareSize}%, 100% 100%`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "-100% -100%, 0 0",
    pointerEvents: "none",
  };

  return (
    <div
      className={`relative cursor-pointer overflow-hidden border ${className}`}
      style={{
        width,
        height,
        background,
        borderRadius,
        borderColor,
        ...style,
      }}
      onMouseEnter={animateIn}
      onMouseLeave={animateOut}
    >
      <div ref={overlayRef} style={overlayStyle} />
      {children}
    </div>
  );
}
