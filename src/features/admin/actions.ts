"use server";

import { ALLOWED_STATUS_TRANSITIONS, ENQUIRY_STATUSES, type EnquiryStatus } from "./types";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { SHEETS_CACHE_TAG } from "@/features/catalogue/constants";
import {
  brandInputSchema,
  brandPatchSchema,
  categoryInputSchema,
  categoryPatchSchema,
  createBrand,
  createCategory,
  createProduct,
  productInputSchema,
  productPatchSchema,
  setBusinessSetting,
  updateBrand,
  updateCategory,
  updateProduct,
} from "@/features/catalogue/write";
import { SheetsValidationError } from "@/features/catalogue/write-errors";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

function revalidateCataloguePaths() {
  try {
    updateTag(SHEETS_CACHE_TAG);
  } catch {
    try {
      revalidateTag(SHEETS_CACHE_TAG, { expire: 0 });
    } catch {
      // ignore
    }
  }
  revalidatePath("/", "layout");
  revalidatePath("/products");
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
}

function handleWriteError(err: unknown, fallbackMessage: string): never {
  if (err instanceof SheetsValidationError) {
    const errorDetails = err.issues.map((i) => i.message).join("; ");
    throw new AppError("VALIDATION", errorDetails || err.publicMessage);
  }
  if (err instanceof AppError) {
    throw err;
  }
  logger.error("admin_sheet_mutation_error", {
    error: err instanceof Error ? err.message : String(err),
  });
  throw new AppError("INTERNAL", fallbackMessage);
}

// ── Product Mutations ──────────────────────────────────────────────────────────────────────────

export async function createProductAction(
  rawInput: unknown,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; name: string }>> {
  return withAdminAction(
    "createProduct",
    async () => {
      try {
        const parsed = productInputSchema.parse(rawInput);
        const product = await createProduct(parsed);
        revalidateCataloguePaths();
        return { id: product.id, name: product.name };
      } catch (err) {
        handleWriteError(err, "Failed to create product in Google Sheets.");
      }
    },
    clientOverride,
  );
}

export async function updateProductAction(
  id: string,
  rawPatch: unknown,
  expectedUpdatedAt?: string | null,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; name: string }>> {
  return withAdminAction(
    "updateProduct",
    async (admin) => {
      try {
        const parsed = productPatchSchema.parse(rawPatch);
        const result = await updateProduct(id, parsed, {
          expectedUpdatedAt,
          updatedBy: admin.email,
        });
        revalidateCataloguePaths();
        return { id: result.product.id, name: result.product.name };
      } catch (err) {
        handleWriteError(err, "Failed to update product in Google Sheets.");
      }
    },
    clientOverride,
  );
}

export async function toggleProductActiveAction(
  id: string,
  isActive: boolean,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; isActive: boolean }>> {
  return withAdminAction(
    "toggleProductActive",
    async (admin) => {
      try {
        const result = await updateProduct(id, { isActive }, { updatedBy: admin.email });
        revalidateCataloguePaths();
        return { id: result.product.id, isActive: result.product.isActive };
      } catch (err) {
        handleWriteError(err, "Failed to update product status.");
      }
    },
    clientOverride,
  );
}

// ── Category Mutations ─────────────────────────────────────────────────────────────────────────

export async function createCategoryAction(
  rawInput: unknown,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; name: string }>> {
  return withAdminAction(
    "createCategory",
    async () => {
      try {
        const parsed = categoryInputSchema.parse(rawInput);
        const category = await createCategory(parsed);
        revalidateCataloguePaths();
        return { id: category.id, name: category.name };
      } catch (err) {
        handleWriteError(err, "Failed to create category.");
      }
    },
    clientOverride,
  );
}

export async function updateCategoryAction(
  id: string,
  rawPatch: unknown,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; name: string }>> {
  return withAdminAction(
    "updateCategory",
    async () => {
      try {
        const parsed = categoryPatchSchema.parse(rawPatch);
        const category = await updateCategory(id, parsed);
        revalidateCataloguePaths();
        return { id: category.id, name: category.name };
      } catch (err) {
        handleWriteError(err, "Failed to update category.");
      }
    },
    clientOverride,
  );
}

export async function toggleCategoryActiveAction(
  id: string,
  isActive: boolean,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; isActive: boolean }>> {
  return withAdminAction(
    "toggleCategoryActive",
    async () => {
      try {
        const category = await updateCategory(id, { isActive });
        revalidateCataloguePaths();
        return { id: category.id, isActive: category.isActive };
      } catch (err) {
        if (err instanceof SheetsValidationError) {
          const hasDependentProducts = err.issues.some((i) => i.code === "INACTIVE_CATEGORY");
          if (hasDependentProducts) {
            throw new AppError(
              "VALIDATION",
              "Cannot deactivate category: active products still reference this category. Deactivate or reassign those products first.",
            );
          }
        }
        handleWriteError(err, "Failed to update category status.");
      }
    },
    clientOverride,
  );
}

// ── Brand Mutations ────────────────────────────────────────────────────────────────────────────

export async function createBrandAction(
  rawInput: unknown,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; name: string }>> {
  return withAdminAction(
    "createBrand",
    async () => {
      try {
        const parsed = brandInputSchema.parse(rawInput);
        const brand = await createBrand(parsed);
        revalidateCataloguePaths();
        return { id: brand.id, name: brand.name };
      } catch (err) {
        handleWriteError(err, "Failed to create brand.");
      }
    },
    clientOverride,
  );
}

export async function updateBrandAction(
  id: string,
  rawPatch: unknown,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; name: string }>> {
  return withAdminAction(
    "updateBrand",
    async () => {
      try {
        const parsed = brandPatchSchema.parse(rawPatch);
        const brand = await updateBrand(id, parsed);
        revalidateCataloguePaths();
        return { id: brand.id, name: brand.name };
      } catch (err) {
        handleWriteError(err, "Failed to update brand.");
      }
    },
    clientOverride,
  );
}

export async function toggleBrandActiveAction(
  id: string,
  isActive: boolean,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; isActive: boolean }>> {
  return withAdminAction(
    "toggleBrandActive",
    async () => {
      try {
        const brand = await updateBrand(id, { isActive });
        revalidateCataloguePaths();
        return { id: brand.id, isActive: brand.isActive };
      } catch (err) {
        if (err instanceof SheetsValidationError) {
          const hasDependentProducts = err.issues.some((i) => i.code === "INACTIVE_BRAND");
          if (hasDependentProducts) {
            throw new AppError(
              "VALIDATION",
              "Cannot deactivate brand: active products still reference this brand. Deactivate or reassign those products first.",
            );
          }
        }
        handleWriteError(err, "Failed to update brand status.");
      }
    },
    clientOverride,
  );
}

// ── Business Settings Mutations ────────────────────────────────────────────────────────────────

export async function updateBusinessSettingsAction(
  settingsRecord: Record<string, string>,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ updatedCount: number }>> {
  return withAdminAction(
    "updateBusinessSettings",
    async () => {
      try {
        let updatedCount = 0;
        for (const [key, value] of Object.entries(settingsRecord)) {
          await setBusinessSetting(key, value);
          updatedCount++;
        }
        revalidateCataloguePaths();
        return { updatedCount };
      } catch (err) {
        handleWriteError(err, "Failed to update business settings.");
      }
    },
    clientOverride,
  );
}

// ── Enquiry Mutations ──────────────────────────────────────────────────────────────────────────

export async function updateEnquiryStatusAction(
  enquiryId: string,
  newStatus: EnquiryStatus,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; status: EnquiryStatus }>> {
  return withAdminAction(
    "updateEnquiryStatus",
    async (_admin, client) => {
      if (!ENQUIRY_STATUSES.includes(newStatus)) {
        throw new AppError("VALIDATION", `Invalid status: ${newStatus}`);
      }

      // Fetch current status to validate transition
      const { data: current, error: fetchError } = await client
        .from("enquiries")
        .select("status")
        .eq("id", enquiryId)
        .maybeSingle();

      if (fetchError || !current) {
        throw new AppError("NOT_FOUND", "Enquiry not found.");
      }

      const currentStatus = current.status as EnquiryStatus;
      if (currentStatus !== newStatus) {
        const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];
        if (!allowed.includes(newStatus)) {
          throw new AppError(
            "VALIDATION",
            `Cannot transition enquiry status from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(", ") || "none"}.`,
          );
        }
      }

      const { error: updateError } = await client
        .from("enquiries")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", enquiryId);

      if (updateError) {
        throw new AppError("INTERNAL", `Failed to update enquiry status: ${updateError.message}`);
      }

      revalidatePath("/admin/enquiries");
      revalidatePath(`/admin/enquiries/${enquiryId}`);
      revalidatePath("/admin/dashboard");

      return { id: enquiryId, status: newStatus };
    },
    clientOverride,
  );
}

export async function addEnquiryNoteAction(
  enquiryId: string,
  body: string,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ id: string; body: string }>> {
  return withAdminAction(
    "addEnquiryNote",
    async (admin, client) => {
      const cleanBody = body.trim();
      if (!cleanBody || cleanBody.length > 2000) {
        throw new AppError("VALIDATION", "Note content must be between 1 and 2000 characters.");
      }

      const { data, error } = await client
        .from("enquiry_notes")
        .insert({
          enquiry_id: enquiryId,
          author_id: admin.id,
          body: cleanBody,
        })
        .select("id, body")
        .single();

      if (error || !data) {
        throw new AppError("INTERNAL", `Failed to add internal note: ${error?.message}`);
      }

      revalidatePath(`/admin/enquiries/${enquiryId}`);
      return { id: data.id, body: data.body };
    },
    clientOverride,
  );
}

export async function retryNotificationAction(
  outboxId: string,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<{ retried: boolean; reason?: string }>> {
  return withAdminAction(
    "retryNotification",
    async (_admin, client) => {
      const { data, error } = await client.rpc("retry_notification", {
        p_outbox_id: outboxId,
      });

      if (error) {
        throw new AppError("INTERNAL", `Failed to retry notification: ${error.message}`);
      }

      revalidatePath("/admin/enquiries");
      return {
        retried: Boolean(data?.retried),
        reason: data?.reason,
      };
    },
    clientOverride,
  );
}
