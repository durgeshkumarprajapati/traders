import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  WhatsAppProvider,
  WhatsAppProviderConfig,
  WhatsAppSendRequest,
  WhatsAppSendResult,
} from "./types";

export function getWhatsAppProviderConfig(): WhatsAppProviderConfig {
  const accessToken = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();

  if (!accessToken || !phoneNumberId) {
    return { configured: false, provider: "NONE" };
  }
  return {
    configured: true,
    provider: "META_CLOUD_API",
    accessToken,
    phoneNumberId,
    webhookVerifyToken,
    appSecret,
  };
}

export function verifyWhatsAppWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined,
): boolean {
  if (!appSecret || !signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  readonly name = "META_CLOUD_API";
  private readonly config: WhatsAppProviderConfig;

  constructor(config = getWhatsAppProviderConfig()) {
    this.config = config;
  }

  isConfigured(): boolean {
    return this.config.configured && Boolean(this.config.accessToken && this.config.phoneNumberId);
  }

  async sendTemplateMessage(req: WhatsAppSendRequest): Promise<WhatsAppSendResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        errorCode: "NOT_CONFIGURED",
        errorSummary: "WhatsApp Cloud API credentials are not configured.",
      };
    }

    const digits = req.recipientMobile.replace(/\D/g, "");
    const to = digits.length === 10 ? `91${digits}` : digits;
    const url = `https://graph.facebook.com/v21.0/${this.config.phoneNumberId}/messages`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: req.templateName,
            language: { code: req.languageCode ?? "en" },
            ...(req.parameters && req.parameters.length > 0
              ? {
                  components: [
                    {
                      type: "body",
                      parameters: req.parameters.map((text) => ({ type: "text", text })),
                    },
                  ],
                }
              : {}),
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const body = (await res.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string; code?: number };
      };

      if (!res.ok) {
        return {
          ok: false,
          errorCode: String(body.error?.code ?? res.status),
          errorSummary: body.error?.message?.slice(0, 280) ?? `HTTP ${res.status}`,
        };
      }

      return {
        ok: true,
        providerMessageId: body.messages?.[0]?.id,
      };
    } catch {
      return {
        ok: false,
        errorCode: "NETWORK_ERROR",
        errorSummary: "Network error while contacting WhatsApp Cloud API.",
      };
    }
  }
}
