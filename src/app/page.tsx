"use client";
import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { HeroNavbar } from "@/components/home/hero-navbar";
import { Hero3DShowcase } from "@/components/home/hero-3d-showcase";
import { DotDistortionShader } from "@/components/ui/dot-distortion-shader";
import { WorkspaceGenerator } from "@/components/ai/workspace-generator";
import { useStore } from "@/lib/workspace/store";
import { Badge } from "@/components/ui/primitives";
import { ImportWorkspaceButton } from "@/components/layout/import-workspace-button";

export default function HomePage() {
  const { workspaces, setActive } = useStore();
  const generatorRef = useRef<HTMLDivElement>(null);

  const scrollToGenerator = () => {
    generatorRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="dark relative min-h-screen bg-[#06080e] text-white selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      {/* Floating Pill Glass Navbar */}
      <HeroNavbar onGetStarted={scrollToGenerator} />

      {/* Atmospheric Background Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 -z-10 h-[800px] w-full max-w-5xl opacity-80 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at 75% 30%, rgba(34, 211, 238, 0.16), rgba(147, 51, 234, 0.14) 40%, transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-48 top-96 -z-10 size-[600px] opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(79, 70, 229, 0.25), transparent 70%)",
        }}
      />

      {/* ========================================================================= */}
      {/* HERO SECTION: Interactive Dot Distortion Shader (Aceternity UI Style)     */}
      {/* ========================================================================= */}
      <DotDistortionShader
        gap={28}
        dotSize={1.5}
        mouseRadius={160}
        distortionStrength={44}
        returnSpeed={0.08}
        baseColor="rgba(148, 163, 184, 0.3)"
        activeColor="rgba(34, 211, 238, 0.95)"
        pulseColor="rgba(168, 85, 247, 0.75)"
        glow={true}
        className="w-full pt-28 pb-16 sm:pt-32"
      >
        <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
            {/* Hero Left Column */}
            <div className="space-y-6 lg:col-span-6 xl:col-span-5">
              {/* Eyebrow Label */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-semibold text-gray-300 backdrop-blur-md">
                <span className="size-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]" />
                <span>Dynamic AI Workspaces · বাংলা, Banglish & English</span>
              </div>

              {/* Main Headline (Aceternity Pro Style) */}
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-5xl xl:text-6xl leading-[1.08]">
                Build your next workspace in<br />
                <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                  minutes, not hours.
                </span>
              </h1>

              {/* Subtext */}
              <p className="max-w-lg text-sm text-gray-400 sm:text-base leading-relaxed">
                Harness the power of next-generation 3D AI project management. Boost productivity, visualize progress, and align teams effortlessly in <span className="text-cyan-300 font-medium">বাংলা</span>, <span className="text-cyan-300 font-medium">Banglish</span> or <span className="text-cyan-300 font-medium">English</span>.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {/* Primary Glowing Cyan Button */}
                <button
                  onClick={scrollToGenerator}
                  className="group relative inline-flex items-center gap-2.5 rounded-full border border-cyan-400 bg-[#0e2230] px-7 py-3 text-sm font-bold text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.45)] backdrop-blur-md transition-all duration-300 hover:bg-cyan-400 hover:text-black hover:shadow-[0_0_45px_rgba(34,211,238,0.7)] active:scale-95"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </button>

                {/* Secondary Dark Frosted Button (0 Tokens Safe Demo) */}
                <button
                  onClick={scrollToGenerator}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-gray-300 shadow-md backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
                >
                  <span>⚡ Free Demo (0 Tokens)</span>
                </button>
              </div>
            </div>

            {/* Hero Right Column: Exact 3D Holographic Kanban & Cubes Showcase */}
            <div className="lg:col-span-6 xl:col-span-7">
              <Hero3DShowcase />
            </div>
          </div>
        </section>
      </DotDistortionShader>

      {/* ========================================================================= */}
      {/* INTERACTIVE WORKSPACE GENERATOR SECTION (Revealed on Scroll or CTA)      */}
      {/* ========================================================================= */}
      <section ref={generatorRef} className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 space-y-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            <Sparkles className="size-3.5 animate-pulse" />
            <span>Interactive AI Engine</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
            Build Your Workspace with Natural Language
          </h2>
          <p className="text-sm text-gray-400">
            Prompt your requirement in any language. The 3D engine synthesizes your custom dashboard live.
          </p>
        </div>

        {/* 3D Glass Container around the Workspace Generator */}
        <div className="card-3d rounded-3xl border border-cyan-500/25 bg-[#0a101d]/85 p-2 shadow-[0_20px_70px_rgba(0,0,0,0.8),0_0_35px_rgba(34,211,238,0.1)] backdrop-blur-2xl">
          <WorkspaceGenerator />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ACTIVE WORKSPACES SECTION                                                 */}
      {/* ========================================================================= */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Your Saved Workspaces</h3>
            <p className="text-xs text-gray-400">Stored safely in browser LocalStorage</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-cyan-400">
              {workspaces.length} Available
            </span>
            <ImportWorkspaceButton className="border-white/15 bg-white/5 text-gray-200 hover:bg-white/10" />
          </div>
        </div>

        {workspaces.length === 0 ? (
          <div className="card-3d rounded-2xl border border-dashed border-white/10 bg-[#0c121e]/50 p-10 text-center text-sm text-gray-400 backdrop-blur-md">
            No workspaces in this browser yet. Prompt above to assemble your first dashboard, or import one you exported from another browser or from localhost (Settings → Export workspace).
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((w) => (
              <Link
                key={w.id}
                href="/dashboard"
                onClick={() => setActive(w.id)}
                className="card-3d group flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0d1424]/80 p-5 shadow-lg backdrop-blur-md transition-all hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.18)]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold leading-snug text-white group-hover:text-cyan-300 transition-colors">
                      {w.config.name}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {w.isDemo && <Badge color="amber">demo</Badge>}
                      <Badge color="violet">{w.config.language}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-gray-400">
                    {w.config.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-gray-400">
                  <span>{w.config.pages.length} pages · {w.data.tasks.length} tasks</span>
                  <span className="flex items-center gap-1 font-semibold text-cyan-400 opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
                    Open <ChevronRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#05070c] py-8 text-center text-xs text-gray-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            <span className="font-semibold text-gray-300">Kajflow AI</span>
            <span>— 3D Dynamic Work Management</span>
          </div>
          <p>© 2026 Kajflow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
