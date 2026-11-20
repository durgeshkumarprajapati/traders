import { AppError, toErrorResponse } from "./errors";

describe("toErrorResponse", () => {
  it("maps AppError to its status with public message", async () => {
    const res = toErrorResponse(new AppError("NOT_FOUND", "Missing"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Missing" } });
  });
  it("hides internal details of unknown errors", async () => {
    const res = toErrorResponse(new Error("db password leaked"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("leaked");
  });
});
