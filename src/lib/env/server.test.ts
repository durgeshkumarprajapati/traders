import { serverEnv } from "./server";

describe("serverEnv", () => {
  it("parses with all integration vars optional", () => {
    expect(serverEnv().NODE_ENV).toBe("test");
  });
});
