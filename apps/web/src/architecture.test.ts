import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const sourceFiles = [...new Bun.Glob("**/*.{ts,tsx}").scanSync(import.meta.dir)].filter(
  (file) => !/\.test\.tsx?$/.test(file),
);

const isSourceFile = (file: string) => existsSync(join(import.meta.dir, file));

/** Each named import from a file in this app, as `<importer> imports <name> from <file>`. */
const namedImports = sourceFiles.flatMap((file) => {
  const source = readFileSync(join(import.meta.dir, file), "utf8");
  return [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"(\.[^"]+)"/g)].flatMap(
    ([, names = "", path = ""]) => {
      const resolved = join(dirname(file), path);
      const from = [".ts", ".tsx"].map((extension) => resolved + extension).find(isSourceFile);
      if (!from) return [];
      return names
        .split(",")
        .map((name) => name.replace(/^\s*type\s+/, "").trim())
        .filter(Boolean)
        .map((name) => ({ file, name, from }));
    },
  );
});

const describe = ({ file, name, from }: (typeof namedImports)[number]) =>
  `${file} imports ${name} from ${from}`;

test("only server.tsx imports routers", () => {
  const stray = namedImports.filter(
    ({ file, from }) => from.endsWith(".routes.tsx") && file !== "server.tsx",
  );
  expect(stray.map(describe)).toEqual([]);
});

test("only routers import queries", () => {
  const stray = namedImports.filter(
    ({ file, from }) => from.endsWith(".query.tsx") && !file.endsWith(".routes.tsx"),
  );
  expect(stray.map(describe)).toEqual([]);
});

// A command shown on another page lends that page its form, and nothing else.
test("only routers import commands, except their forms", () => {
  const stray = namedImports.filter(
    ({ file, name, from }) =>
      from.endsWith(".command.tsx") && !file.endsWith(".routes.tsx") && !name.endsWith("Form"),
  );
  expect(stray.map(describe)).toEqual([]);
});
