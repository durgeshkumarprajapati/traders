"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { ATTRIBUTION_SOURCES } from "./types";

const correctSchema = z.object({
  enquiryId: z.string().uuid(),
  source: z.enum(ATTRIBUTION_SOURCES),
});

export async function correctAttributionSourceAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ enquiryId: string }>> {
  const parsed = correctSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", message: "Invalid attribution source." };
  }
  return withAdminAction("correctAttributionSource", async (admin, client) => {
    const { error } = await client
      .from("acquisition_attributions")
      .upsert(
        {
          enquiry_id: parsed.data.enquiryId,
          source: parsed.data.source,
          latest_touch_source: parsed.data.source,
          corrected_by: admin.id,
          corrected_at: new Date().toISOString(),
        },
        { onConflict: "enquiry_id" },
      );

    if (error) throw new AppError("INTERNAL", "Failed to update attribution source.");
    revalidatePath("/admin/analytics");
    revalidatePath(`/admin/enquiries/${parsed.data.enquiryId}`);
    return { enquiryId: parsed.data.enquiryId };
  });
}
