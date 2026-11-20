import { NextResponse } from "next/server";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  await connection();
  try {
    const admin = await requireAdmin();
    return NextResponse.json({
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
