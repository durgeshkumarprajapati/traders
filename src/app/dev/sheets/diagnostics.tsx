import { Suspense } from "react";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Notification } from "@/components/ui/notification";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { getSheetsSnapshot } from "@/features/catalogue/cache";
import { loadSheetsConfig } from "@/lib/google-sheets/config";
import { SheetsConfigError, SheetsError } from "@/lib/google-sheets/errors";

function configStatus() {
  try {
    return { ok: true as const, priceHistory: loadSheetsConfig().priceHistoryEnabled };
  } catch (e) {
    return e instanceof SheetsConfigError
      ? { ok: false as const, missing: e.missing, invalid: e.invalid }
      : { ok: false as const, missing: [] as string[], invalid: ["unknown"] };
  }
}

async function load() {
  try {
    return { ok: true as const, snapshot: await getSheetsSnapshot() };
  } catch (e) {
    return {
      ok: false as const,
      detail: e instanceof SheetsError ? e.detail : "Unexpected error (see server logs)",
    };
  }
}

async function Result() {
  const r = await load();
  if (!r.ok) {
    return (
      <Notification tone="error" title="Could not read the spreadsheet">
        {r.detail}
      </Notification>
    );
  }
  const s = r.snapshot;
  return (
    <>
      <Notification tone="success" title="Connected">
        Read from Google Sheets at {s.fetchedAt} (served through the shared cache: a repeat visit
        within 5 minutes may show the same timestamp).
      </Notification>
      <Table className="mt-gutter-lg">
        <caption className="sr-only">Records per worksheet</caption>
        <THead>
          <Tr>
            <Th>Worksheet</Th>
            <Th>Rows</Th>
            <Th>Valid</Th>
          </Tr>
        </THead>
        <TBody>
          {(["products", "categories", "brands", "settings"] as const).map((k) => (
            <Tr key={k}>
              <Td>{k}</Td>
              <Td>{s.stats[k].rows}</Td>
              <Td>{s.stats[k].valid}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <h2 className="mt-gutter-xl mb-gutter-sm text-headline-md">
        Data issues ({s.issues.length})
      </h2>
      {s.issues.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No issues found.</p>
      ) : (
        <Table>
          <caption className="sr-only">Data issues</caption>
          <THead>
            <Tr>
              <Th>Worksheet</Th>
              <Th>Row</Th>
              <Th>Column</Th>
              <Th>Severity</Th>
              <Th>Code</Th>
              <Th>Message</Th>
            </Tr>
          </THead>
          <TBody>
            {s.issues.map((i, n) => (
              <Tr key={n}>
                <Td>{i.worksheet}</Td>
                <Td>{i.row ?? "—"}</Td>
                <Td>{i.column ?? "—"}</Td>
                <Td>{i.severity}</Td>
                <Td>{i.code}</Td>
                <Td>{i.message}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}

export function SheetsDiagnostics() {
  const cfg = configStatus();
  return (
    <PageContainer className="pb-section-lg">
      <PageHeading
        title="Google Sheets diagnostics"
        description="Development only. Never shows credentials."
      />
      {cfg.ok ? (
        <Notification tone="info" title="Configuration present">
          Required variables are set and well-formed. Price history:{" "}
          {cfg.priceHistory ? "enabled" : "disabled"}.
        </Notification>
      ) : (
        <Notification tone="warning" title="Configuration incomplete">
          Missing: {cfg.missing.join(", ") || "none"}. Invalid: {cfg.invalid.join(", ") || "none"}.
          See docs/ENVIRONMENT.md.
        </Notification>
      )}
      {cfg.ok && (
        <div className="mt-gutter-lg">
          <Suspense fallback={<p role="status">Reading spreadsheet…</p>}>
            <Result />
          </Suspense>
        </div>
      )}
    </PageContainer>
  );
}
