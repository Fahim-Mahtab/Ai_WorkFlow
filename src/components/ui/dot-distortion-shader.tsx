"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface DotDistortionShaderProps {
  /** Distance in pixels between dot centers */
  gap?: number;
  /** Radius of normal dots */
  dotSize?: number;
  /** Radius of mouse influence field */
  mouseRadius?: number;
  /** Maximum pixel displacement when mouse is directly over dot */
  distortionStrength?: number;
  /** Spring return speed (0.01 to 0.3) */
  returnSpeed?: number;
  /** Spring physics damping (0.7 to 0.95) */
  damping?: number;
  /** Base dot color in rgba or hex */
  baseColor?: string;
  /** Highlight color when dots are pushed by cursor */
  activeColor?: string;
  /** Color for ambient breathing pulse */
  pulseColor?: string;
  /** Enable glowing drop-shadow on pushed/pulsing dots */
  glow?: boolean;
  /** Additional container classes */
  className?: string;
  /** Optional overlay children (e.g. hero content) */
  children?: React.ReactNode;
}

interface Dot {
  originX: number;
  originY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  pulseOffset: number;
  pulseSpeed: number;
  isSpecialPulse: boolean;
  specialPulseTime: number;
}

export function DotDistortionShader({
  gap = 26,
  dotSize = 1.6,
  mouseRadius = 150,
  distortionStrength = 38,
  returnSpeed = 0.08,
  damping = 0.86,
  baseColor = "rgba(148, 163, 184, 0.3)", // slate-400 30%
  activeColor = "rgba(34, 211, 238, 0.95)", // glowing cyan neon
  pulseColor = "rgba(168, 85, 247, 0.75)", // subtle violet neon
  glow = true,
  className,
  children,
}: DotDistortionShaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  });
  const animFrameRef = useRef<number | null>(null);

  // Initialize and populate dot grid based on canvas dimensions
  const initGrid = useCallback(
    (width: number, height: number) => {
      const dots: Dot[] = [];
      const cols = Math.ceil(width / gap) + 1;
      const rows = Math.ceil(height / gap) + 1;
      const startX = (width - (cols - 1) * gap) / 2;
      const startY = (height - (rows - 1) * gap) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const originX = startX + c * gap;
          const originY = startY + r * gap;

          dots.push({
            originX,
            originY,
            x: originX,
            y: originY,
            vx: 0,
            vy: 0,
            baseAlpha: 0.3 + Math.random() * 0.3,
            pulseOffset: Math.random() * Math.PI * 2,
            pulseSpeed: 0.015 + Math.random() * 0.025,
            isSpecialPulse: Math.random() < 0.07, // 7% of dots have ambient sparkle
            specialPulseTime: Math.random() * 100,
          });
        }
      }
      dotsRef.current = dots;
    },
    [gap]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      initGrid(width, height);
    };

    handleResize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    let time = 0;

    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      const mouse = mouseRef.current;
      const dots = dotsRef.current;
      const len = dots.length;

      for (let i = 0; i < len; i++) {
        const d = dots[i];

        // 1. Calculate Mouse Distortion Displacement
        if (mouse.active) {
          const dx = d.originX - mouse.x;
          const dy = d.originY - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < mouseRadius && dist > 0) {
            // Non-linear power falloff for realistic magnetic fluid repulsion
            const normDist = 1 - dist / mouseRadius;
            const push = Math.pow(normDist, 1.4) * distortionStrength;
            const angle = Math.atan2(dy, dx);

            const targetX = d.originX + Math.cos(angle) * push;
            const targetY = d.originY + Math.sin(angle) * push;

            // Apply gentle acceleration toward distorted target
            d.vx += (targetX - d.x) * 0.25;
            d.vy += (targetY - d.y) * 0.25;
          }
        }

        // 2. Spring Physics Back to Origin
        const ax = (d.originX - d.x) * returnSpeed;
        const ay = (d.originY - d.y) * returnSpeed;

        d.vx = (d.vx + ax) * damping;
        d.vy = (d.vy + ay) * damping;

        d.x += d.vx;
        d.y += d.vy;

        // 3. Distance from Origin (Displacement Magnitude)
        const dispX = d.x - d.originX;
        const dispY = d.y - d.originY;
        const dispDist = Math.sqrt(dispX * dispX + dispY * dispY);
        const dispRatio = Math.min(dispDist / (distortionStrength * 0.9), 1);

        // 4. Ambient Breathing Pulse
        const breath = Math.sin(time * d.pulseSpeed + d.pulseOffset);
        let alpha = d.baseAlpha + breath * 0.12;

        // Sparkle pulse for special dots
        if (d.isSpecialPulse) {
          const sparkle = Math.sin((time + d.specialPulseTime) * 0.05);
          if (sparkle > 0.85) {
            alpha += (sparkle - 0.85) * 2;
          }
        }

        // 5. Dynamic Rendering & Glow
        ctx.beginPath();

        if (dispRatio > 0.08) {
          // Actively distorted dot - glowing neon cyan!
          const currentRadius = dotSize + dispRatio * 1.3;
          ctx.arc(d.x, d.y, currentRadius, 0, Math.PI * 2);

          if (glow && dispRatio > 0.25) {
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = dispRatio * 10;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.fillStyle = activeColor;
          ctx.globalAlpha = Math.min(0.3 + dispRatio * 0.7, 1);
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        } else if (d.isSpecialPulse && breath > 0.6) {
          // Ambient violet pulse dot
          ctx.arc(d.x, d.y, dotSize * 1.25, 0, Math.PI * 2);
          if (glow) {
            ctx.shadowColor = pulseColor;
            ctx.shadowBlur = 6;
          }
          ctx.fillStyle = pulseColor;
          ctx.globalAlpha = Math.min(alpha + 0.3, 0.9);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // Resting grid dot
          ctx.arc(d.x, d.y, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = baseColor;
          ctx.globalAlpha = Math.max(0.1, Math.min(alpha, 0.6));
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      ro.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    gap,
    dotSize,
    mouseRadius,
    distortionStrength,
    returnSpeed,
    damping,
    baseColor,
    activeColor,
    pulseColor,
    glow,
    initGrid,
  ]);

  // Event Handlers with smooth tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    mouseRef.current.active = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn("relative w-full overflow-hidden", className)}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 size-full"
      />
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}
