"use client";
import React from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, Sparkles } from "lucide-react";
import { useStore } from "@/lib/workspace/store";

export function HeroNavbar({ onGetStarted }: { onGetStarted?: () => void }) {
  const { workspaces } = useStore();

  return (
    <header className="fixed inset-x-0 top-0 z-50 pt-3 pb-3 bg-gradient-to-b from-[#06080e] via-[#06080e]/90 to-transparent px-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-[#0c121e]/80 px-5 py-3 shadow-[0_15px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 text-white shadow-md shadow-cyan-500/20">
            <Sparkles className="size-4 animate-pulse" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">Kajflow</span>
        </Link>

        {/* Center Nav Items */}
        <nav className="hidden items-center gap-7 md:flex">
          <div className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer">
            <span>Features</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </div>
          <div className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer">
            <span>Solutions</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </div>
          <div className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer">
            <span>Resources</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </div>
          <span className="text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer">
            Pricing
          </span>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5">
          {workspaces.length > 0 && (
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors"
            >
              <LayoutDashboard className="size-3.5 text-cyan-400" />
              <span>Workspace ({workspaces.length})</span>
            </Link>
          )}

          <button
            onClick={onGetStarted}
            className="rounded-xl border border-cyan-400/60 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:bg-cyan-400/20 hover:border-cyan-300 transition-all active:scale-95"
          >
            Request Demo
          </button>
        </div>
      </div>
    </header>
  );
}
