// @vitest-environment node
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: process.cwd() });

async function problems(code: string) {
  const [res] = await eslint.lintText(code, { filePath: "src/components/sample.tsx" });
  return res.messages.filter((m) => m.ruleId === "no-restricted-syntax").map((m) => m.message);
}

describe("design-system lint rules", () => {
  it("allows legitimate semantic token usage", async () => {
    const code = `export const a = "bg-primary/90 text-on-surface-variant border-info shadow-overlay outline-primary accent-primary bg-on-surface/50 hover:bg-surface-muted text-on-primary";\nexport const b = { primary: "bg-primary text-on-primary" };\nexport const c = <svg fill="currentColor" />;`;
    expect(await problems(code)).toEqual([]);
  });

  it.each([
    ["default palette", `export const a = "text-gray-500";`],
    ["arbitrary hex", `export const a = "bg-[#fff]";`],
    ["dark variant", `export const a = "dark:bg-surface";`],
  ])("rejects %s", async (_n, code) => {
    expect((await problems(code)).length).toBeGreaterThan(0);
  });

  it.each(["text-white", "bg-black", "border-white", "hover:text-black"])(
    "hints on %s",
    async (cls) => {
      const msgs = await problems(`export const a = "${cls}";`);
      expect(msgs.some((m) => m.includes("do not exist"))).toBe(true);
    },
  );

  it("does not flag similar-looking token names", async () => {
    expect(
      await problems(`export const a = "text-on-primary bg-surface-muted whitespace-nowrap";`),
    ).toEqual([]);
  });

  describe("inline style", () => {
    it("allows runtime-dynamic geometry and CSS custom properties", async () => {
      const code = `export const a = (p: number) => <div style={{ width: \`\${p}%\`, "--progress": p, height: p * 2 }} />;`;
      expect(await problems(code)).toEqual([]);
    });
    it.each([
      ["static colour", `export const a = <div style={{ color: someVar }} />;`],
      ["static literal value", `export const a = <div style={{ width: "40%" }} />;`],
      ["string style", `export const a = <div style="width:40%" />;`],
      ["non-literal object", `const s = {}; export const a = <div style={s} />;`],
      ["spread", `const s = {}; export const a = <div style={{ ...s, width: n }} />;`],
      ["disallowed property", `export const a = <div style={{ margin: n }} />;`],
      ["quoted non-variable key", `export const a = <div style={{ "margin-top": n }} />;`],
    ])("rejects %s", async (_n, code) => {
      expect((await problems(code)).length).toBeGreaterThan(0);
    });
  });
});
