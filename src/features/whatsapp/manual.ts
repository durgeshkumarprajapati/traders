import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function buildQuotationShareUrl(input: {
  customerMobile: string;
  customerName: string;
  businessName: string;
  quotationReference: string;
  quotationUrl: string;
}): string | null {
  const msg = `Hello ${input.customerName}, your quotation ${input.quotationReference} from ${input.businessName} is ready: ${input.quotationUrl}`;
  return buildWhatsAppUrl(input.customerMobile, msg);
}

export function buildEnquiryReferenceShareUrl(input: {
  customerMobile: string;
  customerName: string;
  businessName: string;
  enquiryReference: string;
}): string | null {
  const msg = `Hello ${input.customerName}, thank you for contacting ${input.businessName}. Your enquiry reference is ${input.enquiryReference}.`;
  return buildWhatsAppUrl(input.customerMobile, msg);
}

export function buildOrderStatusShareUrl(input: {
  customerMobile: string;
  customerName: string;
  businessName: string;
  orderReference: string;
  orderStatus: string;
  trackingUrl?: string;
}): string | null {
  const linkPart = input.trackingUrl ? ` Track here: ${input.trackingUrl}` : "";
  const msg = `Hello ${input.customerName}, update from ${input.businessName} on order ${input.orderReference}: status is ${input.orderStatus.replace(/_/g, " ")}.${linkPart}`;
  return buildWhatsAppUrl(input.customerMobile, msg);
}

export function buildFollowupShareUrl(input: {
  customerMobile: string;
  customerName: string;
  businessName: string;
  message: string;
}): string | null {
  const msg = `Hello ${input.customerName}, message from ${input.businessName}: ${input.message}`;
  return buildWhatsAppUrl(input.customerMobile, msg);
}

export function buildCallbackConfirmationShareUrl(input: {
  customerMobile: string;
  customerName: string;
  businessName: string;
  preferredWindow?: string | null;
}): string | null {
  const win = input.preferredWindow ? ` (${input.preferredWindow})` : "";
  const msg = `Hello ${input.customerName}, ${input.businessName} has received your callback request${win}. Our team will call you shortly.`;
  return buildWhatsAppUrl(input.customerMobile, msg);
}

export function buildProjectShareUrl(input: {
  businessWhatsAppNumber: string | null | undefined;
  projectTitle: string;
  projectUrl: string;
}): string | null {
  const msg = `Hello, I saw your project "${input.projectTitle}" (${input.projectUrl}) and would like to enquire about similar materials.`;
  return buildWhatsAppUrl(input.businessWhatsAppNumber, msg);
}
