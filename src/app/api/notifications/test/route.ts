import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import {
  explainEmailFailure,
  loadWeb3FormsConfig,
  sendWeb3FormsEmail,
} from "@/lib/email/web3forms";
import { logger } from "@/lib/logger";

/**
 * Operator-only: sends ONE real test email through Web3Forms so the owner can prove delivery end-to-end
 * (key valid, plan allows server-side sending, message reaches the inbox).
 *
 *   curl -X POST https://<site>/api/notifications/test -H "Authorization: Bearer $CRON_SECRET"
 *
 * POST only (a GET or link prefetch must never send mail). Same auth as the sweeper: refused with 503 while
 * CRON_SECRET is unset, 401 for any other token. The response never contains the access key, the recipient, or
 * customer data — only a classified result and a plain-language next step.
 */
const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  const auth = authorizeCron(request);
  if (auth === "unconfigured")
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "The test route is not configured." } },
      { status: 503, headers: noStore },
    );
  if (auth === "unauthorized")
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized." } },
      { status: 401, headers: noStore },
    );

  const config = loadWeb3FormsConfig();
  if (!config)
    return NextResponse.json(
      {
        ok: false,
        code: "EMAIL_NOT_CONFIGURED",
        hint: "WEB3FORMS_ACCESS_KEY is missing or malformed. Set it in the deployment's environment variables and redeploy.",
      },
      { status: 503, headers: noStore },
    );

  const result = await sendWeb3FormsEmail(config, {
    subject: "Sagar Traders — email delivery test",
    fromName: "Sagar Traders (delivery test)",
    text: "This is a test message from the Sagar Traders website. If you can read it, enquiry emails can be delivered. No customer enquiry is involved.",
  });
  logger.info("email_delivery_test", {
    ok: result.ok,
    kind: result.ok ? null : result.kind,
    status: result.ok ? 200 : result.status,
  });
  if (result.ok)
    return NextResponse.json(
      {
        ok: true,
        message:
          "Web3Forms accepted the test message. Check the inbox that owns the access key (and its spam folder).",
      },
      { headers: noStore },
    );
  return NextResponse.json(
    {
      ok: false,
      kind: result.kind,
      status: result.status,
      summary: result.summary,
      hint: explainEmailFailure(result),
    },
    { status: 502, headers: noStore },
  );
}
