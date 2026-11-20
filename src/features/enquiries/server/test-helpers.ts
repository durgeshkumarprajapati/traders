/** Test-only wiring (never imported by application code): real services + fake database + recorded side effects. */
import { loadFrom, realisticSheets } from "@/features/catalogue/test-catalogue";
import type { CatalogueLoad } from "@/features/catalogue/server";
import type { EmailMessage, EmailResult } from "@/lib/email/web3forms";
import { FakeSupabase } from "@/lib/supabase/test-utils";
import {
  processDueNotifications,
  processNotification,
  type NotificationDeps,
} from "./notifications";
import type { SubmitDeps } from "./submit";

export const SECRET = "test-rate-limit-secret-0123456789";
export const KEY = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export async function realCatalogue(): Promise<Extract<CatalogueLoad, { ok: true }>> {
  return loadFrom(realisticSheets());
}

export async function setup(
  over: Partial<SubmitDeps> = {},
  sendResult: () => EmailResult | Promise<EmailResult> = () => ({ ok: true }),
) {
  const db = new FakeSupabase();
  const catalogue = await realCatalogue();
  const sent: EmailMessage[] = [];
  const tasks: (() => Promise<unknown>)[] = [];
  const loadCatalogue = vi.fn(async (): Promise<CatalogueLoad> => catalogue);
  const nd: NotificationDeps = {
    rpc: db.rpc,
    web3forms: { accessKey: "11111111-2222-3333-4444-555555555555" },
    send: async (_config, message) => {
      sent.push(message);
      return sendResult();
    },
  };
  const deps: SubmitDeps = {
    rpc: db.rpc,
    rateLimitSecret: SECRET,
    loadCatalogue,
    schedule: (task) => void tasks.push(task),
    processNotification: (id) => processNotification(id, nd),
    processDue: () => processDueNotifications(3, nd),
    ...over,
  };
  return {
    db,
    deps,
    nd,
    sent,
    tasks,
    loadCatalogue,
    /** Run the work that would happen after the HTTP response. */
    runAfter: async () => {
      for (const t of tasks.splice(0)) await t();
    },
  };
}

export const bulkInput = (over: Record<string, unknown> = {}) => ({
  idempotencyKey: KEY(1),
  name: "Asha Rao",
  mobile: "91234 56780",
  email: "asha@example.test",
  deliveryLocation: "Pune site, Gate 2",
  message: "Need it in two lots.",
  website: "",
  items: [
    { productId: "p1", quantity: 100 },
    { productId: "p3", quantity: 5.5 },
  ],
  ...over,
});

export const contactInput = (over: Record<string, unknown> = {}) => ({
  idempotencyKey: KEY(2),
  name: "Ravi Kumar",
  mobile: "9123456789",
  email: "",
  message: "I would like to discuss a delivery schedule.",
  website: "",
  ...over,
});
