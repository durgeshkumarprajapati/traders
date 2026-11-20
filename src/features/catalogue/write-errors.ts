import { SheetsError } from "@/lib/google-sheets/errors";
import type { ValidationIssue } from "./types";

/** A write was rejected before touching the spreadsheet. Carries actionable, credential-free issues. */
export class SheetsValidationError extends SheetsError {
  constructor(public readonly issues: ValidationIssue[]) {
    super(
      "VALIDATION",
      "Some values are not valid. Please correct them and try again.",
      `Write rejected: ${issues.map((i) => `${i.column ?? "row"}: ${i.message}`).join("; ")}`,
    );
  }
}
