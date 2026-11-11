"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Sparkles, Layers, Box, Activity, CheckCircle2 } from "lucide-react";

export function Hero3DShowcase() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeMode, setActiveMode] = useState<"blender" | "deck">("blender");

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 12;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative flex flex-col items-center w-full select-none">
      {/* Mode Switcher Pill */}
      <div className="mb-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#090d16]/80 p-1 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => setActiveMode("blender")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-300 ${
            activeMode === "blender"
              ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.4)]"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <Box className="size-3.5" />
          <span>3D AI Synthesis (Blender)</span>
        </button>
        <button
          onClick={() => setActiveMode("deck")}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-300 ${
            activeMode === "deck"
              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <Layers className="size-3.5" />
          <span>Interactive Deck</span>
        </button>
      </div>

      <div className="perspective-1400 relative flex h-[540px] w-full items-center justify-center lg:h-[600px]">
        {/* Volumetric Radial Ambient Lighting behind the 3D scene */}
        <div
          className="pointer-events-none absolute -inset-10 -z-10 rounded-full opacity-80 blur-3xl"
          style={{
            background:
              "radial-gradient(circle at 60% 45%, rgba(6, 182, 212, 0.28), rgba(139, 92, 246, 0.24) 40%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-20 top-1/4 -z-10 size-96 rounded-full opacity-40 blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(168, 85, 247, 0.35), transparent 70%)",
          }}
        />

        {/* ========================================================================= */}
        {/* MODE 1: BLENDER 3D AI ANIMATION HERO SHOWCASE                             */}
        {/* ========================================================================= */}
        {activeMode === "blender" && (
          <div
            className="preserve-3d relative flex items-center justify-center transition-transform duration-300 ease-out"
            style={{
              transform: `perspective(1200px) rotateX(${12 - mousePos.y * 0.35}deg) rotateY(${
                -10 + mousePos.x * 0.35
              }deg) scale3d(1, 1, 1)`,
            }}
          >
            {/* Holographic Cyber Screen Container */}
            <div className="relative group overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#080d19]/90 p-2.5 shadow-[0_25px_80px_rgba(0,0,0,0.9),0_0_50px_rgba(34,211,238,0.2)] backdrop-blur-2xl">
              {/* Glowing Top Frame Accents */}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-cyan-400 animate-ping shadow-[0_0_10px_#22d3ee]" />
                  <span className="font-mono text-xs font-bold tracking-wider text-cyan-300 uppercase">
                    Kajflow AI // 3D Workspace Engine
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-cyan-300 font-mono font-medium">
                    <Activity className="size-3 animate-pulse" /> Live Construction
                  </span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-400 font-mono font-medium">
                    60 FPS
                  </span>
                </div>
              </div>

              {/* Rendered 3D Animation WebP */}
              <div className="relative h-[340px] w-[500px] sm:h-[400px] sm:w-[580px] lg:h-[420px] lg:w-[620px] overflow-hidden rounded-2xl bg-[#04060b]">
                <Image
                  src="/hero-ai-dashboard.webp"
                  alt="Kajflow AI 3D Dynamic Workspace Construction"
                  fill
                  unoptimized
                  priority
                  className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                />

                {/* Laser Scanline Beam Effect */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-75 shadow-[0_0_15px_#22d3ee] animate-scanline"
                />

                {/* Subtle Vignette & Neon Edge Glow */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080d19]/80 via-transparent to-transparent"
                />
              </div>

              {/* Floating Interactive HUD Tags */}
              <div className="absolute left-6 top-16 z-20 flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-[#0c1626]/85 px-3 py-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <Sparkles className="size-3.5 text-cyan-300 animate-spin" />
                <span className="text-[11px] font-semibold text-white">Neural Core V4.8</span>
              </div>

              <div className="absolute right-6 top-16 z-20 flex items-center gap-2 rounded-xl border border-purple-400/40 bg-[#160d26]/85 px-3 py-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <span className="size-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-[11px] font-semibold text-purple-200">88% Sprint Sync</span>
              </div>

              {/* Bottom Holographic Prompt Bar Overlay */}
              <div className="absolute inset-x-6 bottom-5 z-20 flex items-center justify-between rounded-xl border border-cyan-400/30 bg-[#09111f]/90 px-4 py-2.5 shadow-[0_15px_30px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                <div className="flex items-center gap-2.5 text-xs text-gray-300">
                  <span className="text-cyan-400 font-bold font-mono">✦ Prompt:</span>
                  <span className="text-gray-200 font-medium">
                    Software team sprint board with Kanban & 3D charts...
                  </span>
                  <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  <span>Synthesized</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 2: CLASSIC INTERACTIVE CSS 3D DECK                                   */}
        {/* ========================================================================= */}
        {activeMode === "deck" && (
          <div
            className="preserve-3d relative h-[520px] w-[560px] max-w-full transition-transform duration-300 ease-out sm:w-[620px]"
            style={{
              transform: `perspective(1400px) rotateX(${22 - mousePos.y * 0.4}deg) rotateY(${
                -16 + mousePos.x * 0.4
              }deg) rotateZ(3deg)`,
            }}
          >
            {/* Neon Circuit Lines & Connecting Rays */}
            <svg
              className="pointer-events-none absolute inset-0 size-full"
              style={{ transform: "translateZ(15px)" }}
            >
              <defs>
                <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
                  <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.4" />
                </linearGradient>
                <filter id="neonBlur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path
                d="M 60 260 L 110 260 L 150 280 L 180 280"
                stroke="url(#neonGlow)"
                strokeWidth="2"
                fill="none"
                filter="url(#neonBlur)"
              />
              <path
                d="M 360 170 L 410 130 L 450 130"
                stroke="url(#neonGlow)"
                strokeWidth="2"
                fill="none"
                filter="url(#neonBlur)"
              />
              <path
                d="M 340 370 L 370 410 L 420 410"
                stroke="url(#neonGlow)"
                strokeWidth="2"
                fill="none"
                filter="url(#neonBlur)"
              />

              <circle cx="60" cy="260" r="4" fill="#22d3ee" filter="url(#neonBlur)" />
              <circle cx="180" cy="280" r="3" fill="#38bdf8" />
              <circle cx="450" cy="130" r="4" fill="#a855f7" filter="url(#neonBlur)" />
              <circle cx="420" cy="410" r="3.5" fill="#22d3ee" />
            </svg>

            {/* Top-Left Floating Card */}
            <div
              className="animate-float-slow absolute left-10 top-6 z-20 w-48 rounded-2xl border border-cyan-400/40 bg-[#0c1424]/85 p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_25px_rgba(34,211,238,0.25)] backdrop-blur-2xl"
              style={{ transform: "translateZ(85px)" }}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400">Progress</span>
                <span className="font-mono font-bold text-cyan-300">88%</span>
              </div>
              <div className="mt-1.5 text-xs font-semibold text-white">Task Launch Platform</div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[88%] rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-500 shadow-[0_0_10px_#22d3ee]" />
              </div>
            </div>

            {/* Left Circular Gauge */}
            <div
              className="animate-float-delayed absolute left-0 top-[220px] z-20 flex flex-col items-center gap-3"
              style={{ transform: "translateZ(90px)" }}
            >
              <div className="relative flex size-20 items-center justify-center rounded-full border border-cyan-400/50 bg-[#081220]/90 shadow-[0_0_35px_rgba(34,211,238,0.5)] backdrop-blur-2xl">
                <svg className="size-18 -rotate-90">
                  <circle cx="36" cy="36" r="28" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none" />
                  <circle
                    cx="36"
                    cy="36"
                    r="28"
                    stroke="#22d3ee"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray="176"
                    strokeDashoffset="21"
                    strokeLinecap="round"
                    className="filter drop-shadow-[0_0_8px_#22d3ee]"
                  />
                </svg>
                <span className="absolute font-mono text-sm font-black tracking-tight text-cyan-300">88%</span>
              </div>
            </div>

            {/* Top-Right Isometric Cubes */}
            <div
              className="animate-float-slow absolute right-2 top-2 z-20 flex items-center gap-3.5"
              style={{ transform: "translateZ(95px)" }}
            >
              <div className="group relative flex flex-col items-center">
                <div className="relative size-18 rounded-2xl border border-cyan-400/60 bg-gradient-to-br from-cyan-500/30 via-[#0e2238]/80 to-[#071322] p-2.5 shadow-[0_0_30px_rgba(34,211,238,0.4)] backdrop-blur-2xl transition-transform hover:scale-105">
                  <div className="text-[9px] font-bold text-cyan-300 tracking-wider">Project Nova</div>
                  <div className="mt-2 flex h-6 items-end justify-between px-1">
                    <div className="h-2.5 w-1.5 rounded-t bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                    <div className="h-4.5 w-1.5 rounded-t bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />
                    <div className="h-3.5 w-1.5 rounded-t bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                    <div className="h-5.5 w-1.5 rounded-t bg-cyan-200 shadow-[0_0_8px_#22d3ee]" />
                  </div>
                </div>
              </div>

              <div className="group relative flex flex-col items-center">
                <div className="relative size-18 rounded-2xl border border-teal-400/60 bg-gradient-to-br from-teal-500/30 via-[#0e2a2c]/80 to-[#071322] p-2.5 shadow-[0_0_30px_rgba(20,184,166,0.4)] backdrop-blur-2xl transition-transform hover:scale-105">
                  <div className="text-[9px] font-bold text-teal-300 tracking-wider">Task Aloha</div>
                  <div className="mt-1 flex items-center justify-center">
                    <div className="size-7 rounded-full border-2 border-teal-300 border-t-transparent animate-spin shadow-[0_0_10px_#14b8a6]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Central Kanban Board */}
            <div
              className="absolute left-[140px] top-[140px] z-10 w-[420px] rounded-2xl border border-cyan-400/35 bg-[#0a1222]/85 p-4 shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_40px_rgba(34,211,238,0.2)] backdrop-blur-2xl sm:w-[460px]"
              style={{ transform: "translateZ(50px)" }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
                  <h4 className="text-xs font-bold text-white tracking-wide">Kanban Board</h4>
                </div>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                  45 Tasks
                </span>
              </div>

              <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-gray-400">
                    <span>To Do</span>
                    <span className="text-[9px] text-gray-500">12</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 shadow-sm">
                    <div className="h-2 w-16 rounded bg-white/20" />
                    <div className="mt-2 h-1.5 w-20 rounded bg-white/10" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-cyan-400">
                    <span>In Progress</span>
                    <span className="text-[9px] text-cyan-300 font-bold">18</span>
                  </div>
                  <div className="rounded-xl border border-cyan-400/60 bg-gradient-to-br from-cyan-500/25 via-cyan-500/10 to-transparent p-2.5 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                    <div className="h-2 w-20 rounded bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
                    <div className="mt-2 h-1.5 w-14 rounded bg-cyan-200/50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-emerald-400">
                    <span>Done</span>
                    <span className="text-[9px] text-emerald-400 font-bold">15</span>
                  </div>
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2.5 shadow-sm">
                    <div className="h-2 w-16 rounded bg-emerald-300/80" />
                    <div className="mt-2 h-1.5 w-10 rounded bg-white/10" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Card */}
            <div
              className="animate-float-delayed absolute bottom-6 right-8 z-30 w-56 rounded-2xl border border-cyan-400/50 bg-[#0c1626]/95 p-3.5 shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(34,211,238,0.3)] backdrop-blur-2xl"
              style={{ transform: "translateZ(105px)" }}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-white">Task</span>
                <span className="font-mono font-bold text-cyan-300">88%</span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[88%] rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 shadow-[0_0_10px_#22d3ee]" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
