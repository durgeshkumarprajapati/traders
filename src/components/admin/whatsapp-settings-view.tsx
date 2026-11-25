"use client";

import { useState, useTransition } from "react";
import { MessageSquare, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { updateWhatsAppSettingsAction } from "@/features/whatsapp/actions";
import {
  WHATSAPP_EVENTS,
  type WhatsAppEvent,
  type WhatsAppMessageLog,
  type WhatsAppSettingsRecord,
} from "@/features/whatsapp/types";

export function WhatsAppSettingsView({
  settings,
  logs,
  providerConfigured,
}: {
  settings: WhatsAppSettingsRecord;
  logs: WhatsAppMessageLog[];
  providerConfigured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [automatedEnabled, setAutomatedEnabled] = useState(settings.automatedEnabled);
  const [enabledEvents, setEnabledEvents] = useState<WhatsAppEvent[]>(settings.enabledEvents);
  const [feedback, setFeedback] = useState<string | null>(null);

  function toggleEvent(ev: WhatsAppEvent) {
    setEnabledEvents((prev) =>
      prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev],
    );
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateWhatsAppSettingsAction({
        automatedEnabled,
        provider: providerConfigured ? "META_CLOUD_API" : "NONE",
        enabledEvents,
        templateMappings: settings.templateMappings,
      });
      setFeedback(res.ok ? "WhatsApp settings saved." : res.message);
    });
  }

  return (
    <div className="space-y-gutter-lg">
      <div>
        <h1 className="text-headline-lg text-primary">WhatsApp Integration</h1>
        <p className="text-body-md text-on-surface-variant">
          Manual WhatsApp click-to-chat sharing is active across enquiries, quotations, and orders.
        </p>
      </div>

      {!providerConfigured && (
        <Card className="border border-warning/40 bg-warning/10 p-gutter-md">
          <div className="flex items-start gap-3">
            <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
            <div>
              <p className="text-title-md font-semibold text-on-surface">
                Automated WhatsApp Messaging is Disabled
              </p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Manual WhatsApp sharing links are fully available. To enable automated API delivery,
                configure <code>WHATSAPP_CLOUD_API_TOKEN</code> and{" "}
                <code>WHATSAPP_PHONE_NUMBER_ID</code> in your server environment variables.
              </p>
            </div>
          </div>
        </Card>
      )}

      {feedback && (
        <div role="status" className="rounded border border-info bg-surface-muted px-4 py-2 text-body-md">
          {feedback}
        </div>
      )}

      <Card className="p-gutter-md">
        <h2 className="flex items-center gap-2 text-headline-sm text-primary">
          <MessageSquare aria-hidden className="size-5" />
          Automated Delivery Settings
        </h2>
        <form className="mt-gutter-md space-y-gutter-md" onSubmit={handleSave}>
          <div className="flex items-center gap-2">
            <input
              id="wa-auto"
              type="checkbox"
              checked={automatedEnabled}
              disabled={!providerConfigured}
              onChange={(e) => setAutomatedEnabled(e.target.checked)}
            />
            <label htmlFor="wa-auto" className="text-body-md text-on-surface">
              Enable automated WhatsApp template notifications (requires configured Meta Cloud API)
            </label>
          </div>

          <div>
            <p className="text-label-lg font-semibold text-on-surface">Supported Events</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {WHATSAPP_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-body-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={enabledEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                  />
                  <span>{ev.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" size="sm" disabled={pending}>
            Save WhatsApp Settings
          </Button>
        </form>
      </Card>

      <Card className="p-gutter-md">
        <h2 className="text-headline-sm text-primary">Message Delivery Logs</h2>
        {logs.length === 0 ? (
          <p className="mt-2 text-body-md text-on-surface-variant">No WhatsApp logs recorded yet.</p>
        ) : (
          <ul className="mt-gutter-sm divide-y divide-border text-body-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-medium text-on-surface">{l.eventType}</span> •{" "}
                  <span className="tabular-nums">{l.recipientMobile}</span>
                  {l.errorSummary && (
                    <p className="text-error">{l.errorSummary}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={l.status === "FAILED" ? "error" : "neutral"}>{l.status}</Badge>
                  <span className="text-on-surface-variant">
                    {new Date(l.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
