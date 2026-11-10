"use client";
import React, { useRef, useState, useEffect } from "react";
import { Check, Sparkles, TrendingUp, Users } from "lucide-react";

export function Interactive3DStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x >= -50 && x <= rect.width + 50 && y >= -50 && y <= rect.height + 50) {
        setIsHovered(true);
        // Normalize -1 to 1
        const normX = (x / rect.width - 0.5) * 2;
        const normY = (y / rect.height - 0.5) * 2;

        setRotate({
          x: -normY * 14, // Max tilt degrees
          y: normX * 18,
        });

        setGlowPos({
          x: (x / rect.width) * 100,
          y: (y / rect.height) * 100,
        });
      } else {
        setIsHovered(false);
        setRotate({ x: 0, y: 0 });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="perspective-1400 relative h-72 w-full select-none"
    >
      {/* Dynamic Cursor Light Cone */}
      <div
        className="pointer-events-none absolute -inset-10 rounded-full opacity-0 blur-3xl transition-opacity duration-500"
        style={{
          opacity: isHovered ? 0.45 : 0.2,
          background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.15) 50%, transparent 70%)`,
        }}
      />

      {/* 3D Transform Anchor */}
      <div
        className="preserve-3d relative size-full transition-transform duration-200 ease-out"
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        }}
      >
        {/* Layer 1: Background Grid Matrix (Deep Layer) */}
        <div
          className="absolute inset-4 rounded-2xl border border-primary/20 bg-card/40 backdrop-blur-xl shadow-2xl transition-all"
          style={{ transform: "translateZ(0px)" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Kajflow Engine 3D
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px]">Real-Time WebGL Matrix</span>
          </div>
        </div>

        {/* Layer 2: Main Floating Kanban Card (Z: +40px) */}
        <div
          className="card-3d absolute left-6 top-10 w-64 rounded-xl border border-white/20 bg-card/90 p-3.5 shadow-2xl backdrop-blur-2xl transition-all"
          style={{ transform: "translateZ(45px)" }}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Sprint 2 Active
            </span>
            <span className="text-[10px] text-muted-foreground">12m ago</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-foreground">Citizen Data Verification</p>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="size-3 text-primary" />
              <span>12 Operators</span>
            </div>
            <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-500">
              <Check className="size-3" />
            </span>
          </div>
        </div>

        {/* Layer 3: High Floating Metric Badge (Z: +80px) */}
        <div
          className="card-3d absolute -bottom-2 right-6 w-52 rounded-xl border border-primary/30 bg-card/95 p-3.5 shadow-2xl backdrop-blur-2xl transition-all"
          style={{ transform: "translateZ(85px)" }}
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-muted-foreground">Daily Throughput</span>
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-500">
              <TrendingUp className="size-3" /> +28.4%
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black tracking-tight text-foreground">5,420</span>
            <span className="text-[10px] text-muted-foreground">records / day</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[88%] rounded-full bg-gradient-to-r from-primary via-indigo-500 to-purple-500" />
          </div>
        </div>

        {/* Layer 4: Orbital Holographic Pill (Z: +110px) */}
        <div
          className="animate-float-slow absolute -top-4 right-10 flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-400 shadow-xl backdrop-blur-xl"
          style={{ transform: "translateZ(110px)" }}
        >
          <Sparkles className="size-3.5 animate-pulse text-indigo-400" />
          <span>Trilingual AI Active</span>
        </div>
      </div>
    </div>
  );
}
