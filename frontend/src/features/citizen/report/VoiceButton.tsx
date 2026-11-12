import { Mic, MicOff } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function recognitionClass(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Voice input in Hindi or English. The text lands in the box for the user to check and edit. */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const { t, i18n } = useTranslation();
  const [listening, setListening] = useState(false);
  const ref = useRef<Recognition | null>(null);
  const Klass = recognitionClass();
  if (!Klass) return null;

  function toggle() {
    if (listening) {
      ref.current?.stop();
      return;
    }
    const rec = new Klass!();
    rec.lang = i18n.language === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    ref.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <Button variant="secondary" size="sm" icon={listening ? MicOff : Mic} onClick={toggle} aria-pressed={listening}>
      {listening ? t("voice.stop") : t("voice.start")}
    </Button>
  );
}
