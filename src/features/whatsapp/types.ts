export const WHATSAPP_EVENTS = [
  "NEW_ENQUIRY",
  "ENQUIRY_STATUS_CHANGED",
  "QUOTATION_ISSUED",
  "QUOTATION_REMINDER",
  "QUOTATION_ACCEPTED",
  "QUOTATION_REVISION_REQUESTED",
  "CALLBACK_REQUEST_RECEIVED",
  "ORDER_CREATED",
  "ORDER_DISPATCHED",
  "DELIVERY_COMPLETED",
  "FOLLOWUP_REMINDER",
] as const;

export type WhatsAppEvent = (typeof WHATSAPP_EVENTS)[number];

export interface WhatsAppProviderConfig {
  configured: boolean;
  provider: "NONE" | "META_CLOUD_API";
  phoneNumberId?: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  appSecret?: string;
}

export interface WhatsAppSendRequest {
  recipientMobile: string;
  templateName: string;
  languageCode?: string;
  parameters?: string[];
  idempotencyKey: string;
}

export interface WhatsAppSendResult {
  ok: boolean;
  providerMessageId?: string;
  errorCode?: string;
  errorSummary?: string;
}

export interface WhatsAppProvider {
  readonly name: string;
  isConfigured(): boolean;
  sendTemplateMessage(req: WhatsAppSendRequest): Promise<WhatsAppSendResult>;
}

export interface WhatsAppSettingsRecord {
  automatedEnabled: boolean;
  provider: "NONE" | "META_CLOUD_API";
  enabledEvents: WhatsAppEvent[];
  templateMappings: Record<string, string>;
  updatedAt: string;
}

export interface WhatsAppMessageLog {
  id: string;
  recipientMobile: string;
  eventType: string;
  deliveryMode: "MANUAL_LINK" | "AUTOMATED_API";
  templateName: string | null;
  status: "LINK_GENERATED" | "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  providerMessageId: string | null;
  errorSummary: string | null;
  createdAt: string;
}
