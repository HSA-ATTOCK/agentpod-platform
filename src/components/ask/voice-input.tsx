"use client";

import { Mic, MicOff } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/** The browser's speech recognition (Chrome, Edge, Safari). Audio is handled by the browser, not sent to Baba. */
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};

/** Microphone button: dictate a message. Hidden where the browser can't do speech recognition. */
export function VoiceInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const supported = useSyncExternalStore(noop, () => recognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const base = useRef("");

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    base.current = value ? `${value.trimEnd()} ` : "";
    r.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onChange(`${base.current}${finalText}${interim}`);
    };
    r.onerror = (event) => setError(event.error === "not-allowed" ? "Microphone access was blocked." : "Voice input stopped.");
    r.onend = () => setListening(false);
    recognition.current = r;
    setError(null);
    r.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? "Stop dictating" : "Dictate a message"}
      title={error ?? (listening ? "Listening… click to stop" : "Dictate")}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
        listening ? "animate-pulse bg-danger/15 text-danger" : "text-muted hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {error && !listening ? <MicOff aria-hidden="true" className="size-5" /> : <Mic aria-hidden="true" className="size-5" />}
    </button>
  );
}
