import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerRecord } from "@/features/crm/types";

export interface ContractorMaterialListItem {
  id: string;
  listId: string;
  position: number;
  productId: string;
  productName: string;
  brandName: string | null;
  unitCode: string;
  unitLabel: string;
  quantity: number;
  notes: string | null;
}

export interface ContractorMaterialList {
  id: string;
  customerId: string;
  name: string;
  notes: string | null;
  updatedAt: string;
  items: ContractorMaterialListItem[];
}

export interface CustomerOffer {
  id: string;
  customerId: string;
  title: string;
  description: string | null;
  validFrom: string | null;
  validUntil: string | null;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "CUSTOM_TERM" | null;
  discountValue: number | null;
  isActive: boolean;
  createdAt: string;
}

export async function listContractors(
  clientOverride?: SupabaseClient,
): Promise<CustomerRecord[]> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data } = await supabase
    .from("customers")
    .select("*")
    .is("merged_into_id", null)
    .or("is_contractor.eq.true,customer_type.in.(CONTRACTOR,BUILDER,ARCHITECT)")
    .order("last_interaction_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    mobile: String(r.mobile),
    rawMobile: (r.raw_mobile as string) || null,
    email: (r.email as string) || null,
    companyName: (r.company_name as string) || null,
    address: (r.address as string) || null,
    customerType: String(r.customer_type) as CustomerRecord["customerType"],
    relationshipTier: String(r.relationship_tier) as CustomerRecord["relationshipTier"],
    isContractor: Boolean(r.is_contractor),
    contractorClassification: (r.contractor_classification as string) || null,
    serviceArea: (r.service_area as string) || null,
    preferredCategories: Array.isArray(r.preferred_categories)
      ? r.preferred_categories.map(String)
      : [],
    preferredBrands: Array.isArray(r.preferred_brands) ? r.preferred_brands.map(String) : [],
    relationshipManagerId: (r.relationship_manager_id as string) || null,
    programmeStatus: String(r.programme_status) as CustomerRecord["programmeStatus"],
    lifecycleStatus: String(r.lifecycle_status) as CustomerRecord["lifecycleStatus"],
    whatsappOptIn: Boolean(r.whatsapp_opt_in),
    firstInteractionAt: String(r.first_interaction_at),
    lastInteractionAt: String(r.last_interaction_at),
    mergedIntoId: null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export async function getContractorExtras(
  customerId: string,
  clientOverride?: SupabaseClient,
): Promise<{ lists: ContractorMaterialList[]; offers: CustomerOffer[] }> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const [{ data: listRows }, { data: offerRows }] = await Promise.all([
    supabase
      .from("contractor_material_lists")
      .select("*")
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("customer_offers")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);

  const listIds = (listRows ?? []).map((l: { id: string }) => l.id);
  const itemsByList: Record<string, ContractorMaterialListItem[]> = {};
  if (listIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("contractor_material_list_items")
      .select("*")
      .in("list_id", listIds)
      .order("position", { ascending: true });
    for (const it of itemRows ?? []) {
      (itemsByList[it.list_id] ??= []).push({
        id: String(it.id),
        listId: String(it.list_id),
        position: Number(it.position),
        productId: String(it.product_id),
        productName: String(it.product_name),
        brandName: (it.brand_name as string) || null,
        unitCode: String(it.unit_code),
        unitLabel: String(it.unit_label),
        quantity: Number(it.quantity),
        notes: (it.notes as string) || null,
      });
    }
  }

  const lists: ContractorMaterialList[] = (listRows ?? []).map((l) => ({
    id: String(l.id),
    customerId: String(l.customer_id),
    name: String(l.name),
    notes: (l.notes as string) || null,
    updatedAt: String(l.updated_at),
    items: itemsByList[String(l.id)] ?? [],
  }));

  const offers: CustomerOffer[] = (offerRows ?? []).map((o) => ({
    id: String(o.id),
    customerId: String(o.customer_id),
    title: String(o.title),
    description: (o.description as string) || null,
    validFrom: (o.valid_from as string) || null,
    validUntil: (o.valid_until as string) || null,
    discountType: (o.discount_type as CustomerOffer["discountType"]) || null,
    discountValue: o.discount_value != null ? Number(o.discount_value) : null,
    isActive: Boolean(o.is_active),
    createdAt: String(o.created_at),
  }));

  return { lists, offers };
}
