"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { getWhatsAppProviderConfig } from "./provider";
import { WHATSAPP_EVENTS } from "./types";

const settingsSchema = z.object({
  automatedEnabled: z.boolean(),
  provider: z.enum(["NONE", "META_CLOUD_API"]),
  enabledEvents: z.array(z.enum(WHATSAPP_EVENTS)),
  templateMappings: z.record(z.string(), z.string().max(120)).optional(),
});

export async function updateWhatsAppSettingsAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ saved: true }>> {
  const parsed = settingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", message: "Invalid WhatsApp settings." };
  }
  const v = parsed.data;
  const envCfg = getWhatsAppProviderConfig();
  if (v.automatedEnabled && !envCfg.configured) {
    return {
      ok: false,
      code: "VALIDATION",
      message:
        "Automated WhatsApp messaging cannot be enabled until provider credentials (WHATSAPP_CLOUD_API_TOKEN & WHATSAPP_PHONE_NUMBER_ID) are configured on the server.",
    };
  }

  return withAdminAction("updateWhatsAppSettings", async (admin, client) => {
    const { error } = await client.from("whatsapp_settings").upsert({
      id: 1,
      automated_enabled: v.automatedEnabled,
      provider: v.provider,
      enabled_events: v.enabledEvents,
      template_mappings: v.templateMappings ?? {},
      updated_by: admin.id,
    });
    if (error) throw new AppError("INTERNAL", "Failed to save WhatsApp settings.");
    revalidatePath("/admin/whatsapp");
    return { saved: true };
  });
}
