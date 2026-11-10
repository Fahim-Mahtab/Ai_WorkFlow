"use client";
/**
 * Speak instead of type. Uses the browser's own speech recognition (Chrome / Edge / Safari),
 * so it costs no AI tokens. Bangla (bn-BD) or English (en-US), chosen with the small toggle.
 * The words appear in the text box as you speak; nothing is sent until you press send.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Lang = "bn-BD" | "en-US";
const LANG_KEY = "awp:v1:voice-lang";

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceButton({ value, onChange, disabled, className }: { value: string; onChange: (text: string) => void; disabled?: boolean; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<Lang>("bn-BD");
  const rec = useRef<Recognition | null>(null);
  const base = useRef("");

  useEffect(() => {
    setSupported(!!getRecognition());
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "bn-BD" || saved === "en-US") setLang(saved);
    } catch {
      /* ignore */
    }
    return () => rec.current?.stop();
  }, []);

  if (!supported) return null;

  const start = () => {
    const R = getRecognition();
    if (!R) return;
    const r = new R();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    base.current = value.trim() ? value.trim() + " " : "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onChange(base.current + text.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast.error("Microphone access is blocked. Allow it in the browser's address bar.");
      else if (e.error !== "aborted" && e.error !== "no-speech") toast.error(`Voice input stopped (${e.error}).`);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  const toggleLang = () => {
    const next: Lang = lang === "bn-BD" ? "en-US" : "bn-BD";
    setLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <button
        type="button"
        onClick={toggleLang}
        disabled={listening || disabled}
        className="rounded-md px-1 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        title="Voice language"
        aria-label={`Voice language: ${lang === "bn-BD" ? "Bangla" : "English"}. Click to switch.`}
      >
        {lang === "bn-BD" ? "বাং" : "EN"}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (listening ? rec.current?.stop() : start())}
        className={cn(
          "flex size-8 items-center justify-center rounded-full transition-colors disabled:opacity-50",
          listening ? "animate-pulse bg-red-500 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        title={listening ? "Stop" : "Speak"}
        aria-label={listening ? "Stop voice input" : "Speak instead of typing"}
      >
        {listening ? <Square className="size-3.5" /> : <Mic className="size-4" />}
      </button>
    </span>
  );
}
