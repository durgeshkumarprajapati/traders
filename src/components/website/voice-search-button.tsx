"use client";

import { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { t } from "@/features/i18n/dictionary";
import { useLocale } from "@/features/i18n/store";

const SPEECH_LANG: Record<"en" | "hi" | "gu", string> = {
  en: "en-IN",
  hi: "hi-IN",
  gu: "gu-IN",
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: { 0: SpeechRecognitionResultLike };
}
interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

export function VoiceSearchButton({
  onTranscript,
}: {
  onTranscript: (text: string) => void;
}) {
  const locale = useLocale();
  const [listening, setListening] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  function startVoice() {
    setStatusMsg(null);
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstanceLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setStatusMsg(t(locale, "voice.unsupported"));
      return;
    }

    try {
      const rec = new Ctor();
      rec.lang = SPEECH_LANG[locale];
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      setListening(true);
      setStatusMsg(t(locale, "voice.listening"));

      rec.onresult = (event) => {
        const spoken = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
        if (spoken) {
          onTranscript(spoken);
          setStatusMsg(null);
        }
        setListening(false);
      };
      rec.onerror = (err) => {
        setListening(false);
        if (err.error === "not-allowed" || err.error === "service-not-allowed") {
          setStatusMsg(t(locale, "voice.denied"));
        } else {
          setStatusMsg(t(locale, "voice.unsupported"));
        }
      };
      rec.onend = () => setListening(false);
      rec.start();
    } catch {
      setListening(false);
      setStatusMsg(t(locale, "voice.unsupported"));
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={startVoice}
        aria-label={t(locale, "voice.button")}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded border px-3 py-1.5 text-label-md font-medium transition-colors ${
          listening
            ? "border-secondary bg-secondary text-on-secondary"
            : "border-border bg-surface text-primary hover:bg-surface-muted"
        }`}
      >
        {listening ? <MicOff aria-hidden className="size-4" /> : <Mic aria-hidden className="size-4" />}
        <span>{t(locale, "voice.button")}</span>
      </button>
      {statusMsg && (
        <p role="status" className="text-body-sm text-on-surface-variant">
          {statusMsg}
        </p>
      )}
    </div>
  );
}
