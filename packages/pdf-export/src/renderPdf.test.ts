import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderPdf } from "./renderPdf";

let templates: string;

beforeAll(async () => {
  templates = await mkdtemp(join(tmpdir(), "pdf-export-"));
});

afterAll(() => rm(templates, { recursive: true, force: true }));

async function template(name: string, source: string) {
  const path = join(templates, name);
  await Bun.write(path, source);
  return path;
}

test("renders the template with the data it's given", async () => {
  const path = await template(
    "greeting.typ",
    `#set text(font: "Britti Sans")\nHello, #json(bytes(sys.inputs.data)).name`,
  );
  const pdf = await renderPdf(path, { name: "Kari" });
  expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe("%PDF-");
});

test("a broken template fails with Typst's message", async () => {
  const path = await template("broken.typ", "#undefined-function()");
  await expect(renderPdf(path, {})).rejects.toThrow(/unknown variable: undefined-function/);
});
