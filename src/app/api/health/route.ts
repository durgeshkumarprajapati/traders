import { NextResponse } from "next/server";
import { checkHealth } from "@/features/health/server";

const noStore = { "cache-control": "no-store" };

export async function GET() {
  const result = await checkHealth();
  const statusCode = result.status === "unhealthy" ? 503 : 200;
  return NextResponse.json(result, { status: statusCode, headers: noStore });
}
