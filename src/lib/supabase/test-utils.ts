/**
 * Test helpers only (never imported by application code).
 *
 * `FakeSupabase` emulates the database functions from supabase/migrations/20261118000000_enquiries.sql with the
 * same contract (constraints, atomic all-or-nothing writes, idempotency, outbox lease/claim, rate limiter) so the
 * application services can be tested without a database. The SQL itself is exercised against real PostgreSQL by
 * `migration.test.ts`; this fake only verifies how the application USES that contract.
 */
import { randomUUID } from "node:crypto";
import { SupabaseApiError } from "./errors";
import type { Rpc } from "./rest";

const UNITS = [
  "BAG",
  "PIECE",
  "KG",
  "TON",
  "METRIC_TON",
  "CUBIC_FEET",
  "CUBIC_METER",
  "BUNDLE",
  "BOX",
  "METER",
  "BRASS",
  "BLOCK",
  "CUSTOM",
];
const STOCK = ["IN_STOCK", "LIMITED_STOCK", "OUT_OF_STOCK", "AVAILABLE_ON_ORDER"];

type Json = Record<string, unknown>;
export type EnquiryRow = {
  id: string;
  reference: string;
  type: string;
  status: string;
  customer_name: string;
  mobile: string;
  email: string | null;
  delivery_location: string | null;
  message: string | null;
  idempotency_key: string;
  created_at: string;
};
export type ItemRow = {
  enquiry_id: string;
  position: number;
  product_id: string;
  sku: string | null;
  product_name: string;
  brand_name: string | null;
  unit_code: string;
  unit_label: string;
  quantity: number;
  listed_price: number | null;
  stock_status: string;
};
export type OutboxRow = {
  id: string;
  enquiry_id: string;
  status: "PENDING" | "IN_PROGRESS" | "SENT" | "FAILED";
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: number;
  locked_until: number | null;
  last_error: string | null;
  sent_at: number | null;
};
export type AttemptRow = {
  outbox_id: string;
  attempt_number: number;
  outcome: string;
  http_status: number | null;
  error_code: string | null;
  error_summary: string | null;
};

const violation = (what: string, code = "23514") =>
  new SupabaseApiError(`constraint violation: ${what}`, 400, code, false);

export class FakeSupabase {
  enquiries: EnquiryRow[] = [];
  items: ItemRow[] = [];
  outbox: OutboxRow[] = [];
  attempts: AttemptRow[] = [];
  limits = new Map<string, { windowStart: number; hits: number }>();
  clock = Date.parse("2026-11-18T12:00:00Z");
  seq = 1000;
  calls: { fn: string; args: Json }[] = [];
  private failures = new Map<string, Error[]>();

  advance(ms: number) {
    this.clock += ms;
  }
  /** Make the next call(s) to `fn` throw (simulates an outage). */
  failNext(fn: string, error: Error, times = 1) {
    this.failures.set(fn, Array(times).fill(error));
  }
  count(fn: string) {
    return this.calls.filter((c) => c.fn === fn).length;
  }

  rpc: Rpc = async <T>(fn: string, args: Record<string, unknown>) => {
    this.calls.push({ fn, args });
    const queued = this.failures.get(fn);
    if (queued?.length) throw queued.shift()!;
    switch (fn) {
      case "create_enquiry":
        return this.createEnquiry(args.p_payload as Json) as T;
      case "claim_notification":
        return this.claim(args.p_outbox_id as string, (args.p_lease_seconds as number) ?? 120) as T;
      case "record_notification_attempt":
        return this.record(args) as T;
      case "list_due_notifications":
        return this.listDue((args.p_limit as number) ?? 10) as T;
      case "retry_notification":
        return this.retry(args.p_outbox_id as string) as T;
      case "check_rate_limit":
        return this.rate(
          args.p_key as string,
          args.p_limit as number,
          args.p_window_seconds as number,
        ) as T;
      case "purge_rate_limits":
        return 0 as T;
      default:
        throw new SupabaseApiError(`unknown function ${fn}`, 404, "PGRST202", false);
    }
  };

  // ── create_enquiry: validate EVERYTHING first, then commit all rows (atomic) ──
  private createEnquiry(p: Json) {
    const key = String(p.idempotency_key);
    const existing = this.enquiries.find((e) => e.idempotency_key === key);
    if (existing) {
      return {
        id: existing.id,
        reference: existing.reference,
        outbox_id: this.outbox.find((o) => o.enquiry_id === existing.id)?.id ?? null,
        duplicate: true,
      };
    }
    const str = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v));
    const type = String(p.type);
    if (!["BULK", "GENERAL"].includes(type)) throw violation("type");
    const name = String(p.name ?? "");
    if (name.length < 2 || name.length > 100) throw violation("customer_name");
    if (!/^[6-9][0-9]{9}$/.test(String(p.mobile ?? ""))) throw violation("mobile");
    const email = str(p.email);
    if (email && (email.length > 254 || !email.includes("@"))) throw violation("email");
    const location = str(p.delivery_location);
    if (location && (location.length < 3 || location.length > 300))
      throw violation("delivery_location");
    if (type === "BULK" && !location) throw violation("bulk needs location");
    const message = str(p.message);
    if (message && message.length > 1000) throw violation("message");
    if (type === "GENERAL" && (!message || message.length < 10))
      throw violation("general needs message");

    const rawItems = (p.items as Json[] | undefined) ?? [];
    if (type === "BULK" && rawItems.length === 0) throw violation("bulk needs items");
    const seen = new Set<string>();
    const id = randomUUID();
    const items: ItemRow[] = rawItems.map((it, i) => {
      const pid = String(it.product_id ?? "");
      if (pid.length < 1 || pid.length > 64) throw violation("product_id");
      if (seen.has(pid)) throw violation("duplicate product in enquiry", "23505");
      seen.add(pid);
      const qty = Number(it.quantity);
      if (!(qty > 0 && qty <= 1_000_000)) throw violation("quantity");
      const price =
        it.listed_price === null || it.listed_price === undefined ? null : Number(it.listed_price);
      if (price !== null && !(price > 0)) throw violation("listed_price");
      if (!UNITS.includes(String(it.unit_code))) throw violation("unit_code");
      if (!STOCK.includes(String(it.stock_status))) throw violation("stock_status");
      const label = String(it.unit_label ?? "");
      if (label.length < 1 || label.length > 40) throw violation("unit_label");
      const pname = String(it.product_name ?? "");
      if (pname.length < 1 || pname.length > 200) throw violation("product_name");
      return {
        enquiry_id: id,
        position: i + 1,
        product_id: pid,
        sku: str(it.sku),
        product_name: pname,
        brand_name: str(it.brand_name),
        unit_code: String(it.unit_code),
        unit_label: label,
        quantity: qty,
        listed_price: price,
        stock_status: String(it.stock_status),
      };
    });

    // commit (all or nothing)
    const reference = `ENQ-${new Date(this.clock).getUTCFullYear()}-${String(this.seq++).padStart(6, "0")}`;
    const outboxId = randomUUID();
    this.enquiries.push({
      id,
      reference,
      type,
      status: "NEW",
      customer_name: name,
      mobile: String(p.mobile),
      email,
      delivery_location: location,
      message,
      idempotency_key: key,
      created_at: new Date(this.clock).toISOString(),
    });
    this.items.push(...items);
    this.outbox.push({
      id: outboxId,
      enquiry_id: id,
      status: "PENDING",
      attempt_count: 0,
      max_attempts: 8,
      next_attempt_at: this.clock,
      locked_until: null,
      last_error: null,
      sent_at: null,
    });
    return { id, reference, outbox_id: outboxId, duplicate: false };
  }

  private claim(outboxId: string, leaseSeconds: number) {
    const o = this.outbox.find((r) => r.id === outboxId);
    if (!o) return null;
    const ok =
      ["PENDING", "FAILED", "IN_PROGRESS"].includes(o.status) &&
      o.attempt_count < o.max_attempts &&
      o.next_attempt_at <= this.clock &&
      (o.locked_until === null || o.locked_until <= this.clock);
    if (!ok) return null;
    o.status = "IN_PROGRESS";
    o.attempt_count += 1;
    o.locked_until = this.clock + Math.max(leaseSeconds, 5) * 1000;
    const { idempotency_key: _k, ...enquiry } = this.enquiries.find((e) => e.id === o.enquiry_id)!;
    void _k;
    return {
      outbox_id: o.id,
      attempt_number: o.attempt_count,
      enquiry,
      items: this.items
        .filter((i) => i.enquiry_id === o.enquiry_id)
        .sort((a, b) => a.position - b.position),
    };
  }

  private record(a: Record<string, unknown>) {
    const o = this.outbox.find((r) => r.id === a.p_outbox_id);
    if (!o) throw new SupabaseApiError("unknown outbox row", 404, "P0002", false);
    if (o.status !== "IN_PROGRESS" || o.attempt_count !== a.p_attempt_number)
      return { recorded: false, status: o.status };
    this.attempts.push({
      outbox_id: o.id,
      attempt_number: o.attempt_count,
      outcome: String(a.p_outcome),
      http_status: (a.p_http_status as number) ?? null,
      error_code: (a.p_error_code as string) ?? null,
      error_summary: a.p_error_summary ? String(a.p_error_summary).slice(0, 300) : null,
    });
    o.locked_until = null;
    if (a.p_outcome === "SUCCESS") {
      o.status = "SENT";
      o.sent_at = this.clock;
      o.last_error = null;
      return { recorded: true, status: "SENT" };
    }
    o.status = "FAILED";
    o.last_error = String(a.p_error_summary ?? a.p_error_code ?? "delivery failed").slice(0, 300);
    const retryable = a.p_retryable !== false;
    const delay = Math.min(60 * 2 ** Math.max(o.attempt_count - 1, 0), 21600);
    o.next_attempt_at = retryable ? this.clock + delay * 1000 : Number.POSITIVE_INFINITY;
    return { recorded: true, status: "FAILED", retry_in_seconds: retryable ? delay : null };
  }

  private listDue(limit: number) {
    return this.outbox
      .filter(
        (o) =>
          ["PENDING", "FAILED", "IN_PROGRESS"].includes(o.status) &&
          o.attempt_count < o.max_attempts &&
          o.next_attempt_at <= this.clock &&
          (o.locked_until === null || o.locked_until <= this.clock),
      )
      .sort((a, b) => a.next_attempt_at - b.next_attempt_at)
      .slice(0, Math.max(1, Math.min(limit, 50)))
      .map((o) => o.id);
  }

  private retry(outboxId: string) {
    const o = this.outbox.find((r) => r.id === outboxId);
    if (!o) return { retried: false, reason: "NOT_FOUND" };
    if (o.status === "SENT") return { retried: false, reason: "ALREADY_SENT" };
    if (o.status === "IN_PROGRESS" && (o.locked_until ?? 0) > this.clock)
      return { retried: false, reason: "IN_PROGRESS" };
    o.status = "PENDING";
    o.next_attempt_at = this.clock;
    o.locked_until = null;
    o.max_attempts = Math.min(Math.max(o.max_attempts, o.attempt_count + 3), 50);
    return { retried: true };
  }

  private rate(key: string, limit: number, windowSeconds: number) {
    const w = Math.max(windowSeconds, 1) * 1000;
    const cur = this.limits.get(key);
    const next =
      !cur || cur.windowStart <= this.clock - w
        ? { windowStart: this.clock, hits: 1 }
        : { windowStart: cur.windowStart, hits: cur.hits + 1 };
    this.limits.set(key, next);
    const allowed = next.hits <= limit;
    return {
      allowed,
      hits: next.hits,
      retry_after_seconds: allowed
        ? 0
        : Math.max(Math.ceil((next.windowStart + w - this.clock) / 1000), 1),
    };
  }
}
