"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notification } from "@/components/ui/notification";
import { cardFilename, type BusinessCardData } from "@/features/business-card/data";
import {
  canShareImageFiles,
  downloadBlob,
  renderCardPng,
  shareCardFile,
} from "@/features/business-card/export";
import { BusinessVisitingCard } from "./business-visiting-card";

type Feedback = { tone: "success" | "error" | "info"; text: string } | null;

const noopSubscribe = () => () => undefined;

/** Preview + "Download Business Visiting Card" (and a share button where the browser can share an image file). */
export function BusinessCardPanel({ data }: { data: BusinessCardData }) {
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const inFlight = useRef(false); // synchronous guard: a fast double click can never start two renders
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => canShareImageFiles(),
    () => false,
  );
  const filename = cardFilename(data.name);

  async function run(mode: "download" | "share") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(mode);
    setFeedback(null);
    try {
      const blob = await renderCardPng(data);
      if (mode === "share") {
        const outcome = await shareCardFile(blob, filename, `${data.name} visiting card`);
        if (outcome === "shared") {
          setFeedback({
            tone: "success",
            text: "Your visiting card was handed to the share sheet.",
          });
          return;
        }
        if (outcome === "cancelled") return;
        if (outcome === "failed") {
          setFeedback({
            tone: "error",
            text: "Sharing did not work. You can download the card instead.",
          });
          return;
        }
        // unsupported: fall through to a normal download
      }
      downloadBlob(blob, filename);
      setFeedback({
        tone: "success",
        text: `Your visiting card is downloading as ${filename}. Look in your browser's downloads. To keep it in your phone's gallery, open the image and choose Save or Share.`,
      });
    } catch {
      setFeedback({
        tone: "error",
        text: "We could not create the visiting card image. Please try again.",
      });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="space-y-gutter-md">
      <BusinessVisitingCard data={data} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          onClick={() => void run("download")}
          disabled={busy !== null}
        >
          <Download aria-hidden className="mr-2 size-4" />
          {busy === "download" ? "Preparing Visiting Card…" : "Download Business Visiting Card"}
        </Button>
        {canShare && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => void run("share")}
            disabled={busy !== null}
          >
            <Share2 aria-hidden className="mr-2 size-4" />
            {busy === "share" ? "Preparing Visiting Card…" : "Share card"}
          </Button>
        )}
      </div>
      {feedback && <Notification tone={feedback.tone}>{feedback.text}</Notification>}
    </div>
  );
}
