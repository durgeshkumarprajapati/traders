import "server-only";

import { connection } from "next/server";
import { loadAdminCatalogue } from "@/features/catalogue/server";
import type { ValidationIssue } from "@/features/catalogue/types";
import type { StockStatus } from "@/features/products/stock";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface EnquirySummary {
  id: string;
  reference: string;
  type: "BULK" | "GENERAL";
  status: "NEW" | "CONTACTED" | "QUOTATION_SENT" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  customerName: string;
  mobile: string;
  deliveryLocation: string | null;
  createdAt: string;
}

export interface AdminDashboardData {
  catalogue: {
    totalProducts: number;
    activeProducts: number;
    totalCategories: number;
    activeCategories: number;
    totalBrands: number;
    activeBrands: number;
    availability: Record<StockStatus, number>;
    issues: ValidationIssue[];
  } | null;
  enquiries: {
    totalCount: number;
    newCount: number;
    pendingCount: number;
    recent: EnquirySummary[];
  } | null;
  fetchedAt: string;
}

export async function loadAdminDashboardData(): Promise<AdminDashboardData> {
  await connection();
  const fetchedAt = new Date().toISOString();

  // 1. Fetch catalogue data from Google Sheets
  let catalogueStats: AdminDashboardData["catalogue"] = null;
  try {
    const catResult = await loadAdminCatalogue();
    if (catResult.ok) {
      const { products, categories, brands, issues } = catResult.snapshot;
      const activeProducts = products.filter((p) => p.isActive);

      const availability: Record<StockStatus, number> = {
        IN_STOCK: 0,
        LIMITED_STOCK: 0,
        OUT_OF_STOCK: 0,
        AVAILABLE_ON_ORDER: 0,
      };

      for (const p of activeProducts) {
        if (p.stockStatus in availability) {
          availability[p.stockStatus]++;
        }
      }

      catalogueStats = {
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        totalCategories: categories.length,
        activeCategories: categories.filter((c) => c.isActive).length,
        totalBrands: brands.length,
        activeBrands: brands.filter((b) => b.isActive).length,
        availability,
        issues,
      };
    }
  } catch (err) {
    logger.warn("admin_dashboard_catalogue_load_error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Fetch enquiry stats from Supabase
  let enquiryStats: AdminDashboardData["enquiries"] = null;
  try {
    const supabase = await createSupabaseServerClient();

    // Query recent 10 enquiries
    const { data: recentRows, error: recentError } = await supabase
      .from("enquiries")
      .select("id, reference, type, status, customer_name, mobile, delivery_location, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (recentError) {
      logger.warn("admin_dashboard_enquiries_query_error", { error: recentError.message });
    } else {
      // Query counts
      const { count: totalCount } = await supabase
        .from("enquiries")
        .select("*", { count: "exact", head: true });

      const { count: newCount } = await supabase
        .from("enquiries")
        .select("*", { count: "exact", head: true })
        .eq("status", "NEW");

      const { count: pendingCount } = await supabase
        .from("enquiries")
        .select("*", { count: "exact", head: true })
        .in("status", ["NEW", "CONTACTED", "QUOTATION_SENT"]);

      const recent: EnquirySummary[] = (recentRows || []).map((row) => ({
        id: row.id,
        reference: row.reference,
        type: row.type as "BULK" | "GENERAL",
        status: row.status as EnquirySummary["status"],
        customerName: row.customer_name,
        mobile: row.mobile,
        deliveryLocation: row.delivery_location,
        createdAt: row.created_at,
      }));

      enquiryStats = {
        totalCount: totalCount ?? 0,
        newCount: newCount ?? 0,
        pendingCount: pendingCount ?? 0,
        recent,
      };
    }
  } catch (err) {
    logger.warn("admin_dashboard_supabase_load_error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    catalogue: catalogueStats,
    enquiries: enquiryStats,
    fetchedAt,
  };
}
