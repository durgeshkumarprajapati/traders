import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WhatsAppEvent, WhatsAppMessageLog, WhatsAppSettingsRecord } from "../types";

export async function getWhatsAppSettings(
  clientOverride?: SupabaseClient,
): Promise<WhatsAppSettingsRecord> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data } = await supabase
    .from("whatsapp_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!data) {
    return {
      automatedEnabled: false,
      provider: "NONE",
      enabledEvents: [],
      templateMappings: {},
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    automatedEnabled: Boolean(data.automated_enabled),
    provider: (data.provider as "NONE" | "META_CLOUD_API") ?? "NONE",
    enabledEvents: Array.isArray(data.enabled_events)
      ? (data.enabled_events as WhatsAppEvent[])
      : [],
    templateMappings:
      data.template_mappings && typeof data.template_mappings === "object"
        ? (data.template_mappings as Record<string, string>)
        : {},
    updatedAt: String(data.updated_at),
  };
}

export async function listWhatsAppLogs(
  clientOverride?: SupabaseClient,
): Promise<WhatsAppMessageLog[]> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data } = await supabase
    .from("whatsapp_message_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((r) => ({
    id: String(r.id),
    recipientMobile: String(r.recipient_mobile),
    eventType: String(r.event_type),
    deliveryMode: String(r.delivery_mode) as WhatsAppMessageLog["deliveryMode"],
    templateName: (r.template_name as string) || null,
    status: String(r.status) as WhatsAppMessageLog["status"],
    providerMessageId: (r.provider_message_id as string) || null,
    errorSummary: (r.error_summary as string) || null,
    createdAt: String(r.created_at),
  }));
}
