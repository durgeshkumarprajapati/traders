import { NextResponse, type NextRequest } from "next/server";
import {
  getWhatsAppProviderConfig,
  verifyWhatsAppWebhookSignature,
} from "@/features/whatsapp/provider";
import { logger } from "@/lib/logger";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const cfg = getWhatsAppProviderConfig();
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (!cfg.webhookVerifyToken) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (mode === "subscribe" && token === cfg.webhookVerifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const cfg = getWhatsAppProviderConfig();
  const rawBody = await request.text();
  const sig = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsAppWebhookSignature(rawBody, sig, cfg.appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{ id?: string; status?: string }>;
          };
        }>;
      }>;
    };
    const supabase = getSupabaseAdminClient();
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const st of change.value?.statuses ?? []) {
          if (!st.id || !st.status) continue;
          const mapped =
            st.status === "delivered"
              ? "DELIVERED"
              : st.status === "read"
                ? "READ"
                : st.status === "failed"
                  ? "FAILED"
                  : "SENT";
          await supabase
            .from("whatsapp_message_logs")
            .update({ status: mapped })
            .eq("provider_message_id", st.id);
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("whatsapp_webhook_error", { error });
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }
}
