# WhatsApp Business Integration Guide

## 1. Current Status
- **Manual WhatsApp Sharing:** Active (`src/features/whatsapp/manual.ts` & `src/lib/whatsapp/index.ts`). Generates `https://wa.me/...` links using verified Business Settings and customer records.
- **Automated WhatsApp Cloud API:** Safely disabled until real Meta Cloud API credentials are configured in server environment variables. Never simulates delivery.

## 2. Optional Automated Activation
Set these server-only environment variables in Vercel (and `.env` locally):
- `WHATSAPP_CLOUD_API_TOKEN` — Permanent system-user access token from Meta Business Manager
- `WHATSAPP_PHONE_NUMBER_ID` — WhatsApp Business Phone Number ID
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — Random string for Meta webhook GET verification
- `WHATSAPP_APP_SECRET` — Meta App Secret for `X-Hub-Signature-256` HMAC verification

Webhook endpoint: `/api/whatsapp/webhook` (GET verification + POST status updates).
