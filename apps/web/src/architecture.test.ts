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

test("only routers import commands", () => {
  const stray = namedImports.filter(
    ({ file, from }) => /\.command\.tsx?$/.test(from) && !file.endsWith(".routes.tsx"),
  );
  expect(stray.map(describe)).toEqual([]);
});

const doesIO = (file: string) => /\.(routes|command|query|middleware|data)\.tsx?$/.test(file);

// Plumbing does I/O by nature: the top level and the folders every feature builds on.
const isPlumbing = (file: string) =>
  !file.includes("/") || /^(form|query|errors|testing)\//.test(file);

// Rendering and building SQL are pure; the rest of Hono and the database client aren't.
const isIOPackage = (path: string) =>
  /^(hono(?!\/(jsx|css|html)$)|@tid\/db(?!\/schema$))/.test(path);

/** Every import, type-only and re-exports too, of an app file or a package. */
const allImports = sourceFiles.flatMap((file) => {
  const source = readFileSync(join(import.meta.dir, file), "utf8");
  return [...source.matchAll(/\b(?:import|export)\s[^;"]*?from\s+"([^"]+)"/g)].map(
    ([, path = ""]) => {
      if (!path.startsWith(".")) return { file, from: path };
      const resolved = join(dirname(file), path);
      const from = [".ts", ".tsx"].map((extension) => resolved + extension).find(isSourceFile);
      return { file, from: from ?? resolved };
    },
  );
});

const impureImports = allImports.filter(
  ({ file, from }) =>
    !doesIO(file) &&
    !isPlumbing(file) &&
    (from === "database.ts" || doesIO(from) || isIOPackage(from)),
);

// ponytail: splitting these would only appease the rule. loggableTasks builds SQL, which is pure,
// but with the database client. organizationFilter reads the request for the queries that call it, a
// role no suffix names yet.
const impureFiles = ["organizations/organizationFilter.tsx", "timesheet/loggableTasks.ts"];

test("files without an I/O suffix are pure", () => {
  const stray = impureImports.filter(({ file }) => !impureFiles.includes(file));
  expect(stray.map(({ file, from }) => `${file} imports ${from}`)).toEqual([]);
});

test("the list of impure files only shrinks", () => {
  const nowPure = impureFiles.filter((file) => !impureImports.some((i) => i.file === file));
  expect(nowPure).toEqual([]);
});

const filesContaining = (pattern: RegExp) =>
  sourceFiles.filter((file) => pattern.test(readFileSync(join(import.meta.dir, file), "utf8")));

const isDevTooling = (file: string) => file.startsWith("dev/");

// One file per feature holds its addresses, so a route and the links to it can't disagree.
test("a feature's URLs live in <feature>.url.ts", () => {
  const isFeatureUrlFile = (file: string) => file === `${dirname(file)}/${dirname(file)}.url.ts`;
  const urlFiles = sourceFiles.filter((file) => file.endsWith(".url.ts"));
  const strayUrls = filesContaining(/export const \w*(Path|Url)\b|\bpageUrl\(/).filter(
    (file) => !file.endsWith(".url.ts") && file !== "query/pageUrl.ts" && !isDevTooling(file),
  );
  expect([...urlFiles.filter((file) => !isFeatureUrlFile(file)), ...strayUrls]).toEqual([]);
});

// A form page is what an action opens, so `formAction` frames it: a page of its own couldn't
// tell the browser, or an overlay later, that it's a form.
test("forms leave their page to formAction", () => {
  expect(filesContaining(/<Page\b/).filter((file) => file.endsWith(".form.tsx"))).toEqual([]);
});

test("only formAction renders a form page", () => {
  const stray = filesContaining(/import\s*\{[^}]*\bFormPage\b[^}]*\}\s*from\s*"@tid\/ui"/).filter(
    (file) => file !== "form/formAction.tsx",
  );
  expect(stray).toEqual([]);
});

// ponytail: the timesheet's cell is a form outside a `.form.tsx` until logHours splits it out.
const postingFiles = ["timesheet/timesheetCell.tsx"];

test("only forms post", () => {
  const stray = filesContaining(/method="post"/).filter(
    (file) => !file.endsWith(".form.tsx") && !isDevTooling(file) && !postingFiles.includes(file),
  );
  expect(stray).toEqual([]);
});

// Adding a timesheet row keeps every `add` already in the query, which a filter would replace.
const queryFormFiles = ["query/filter.tsx", "timesheet/timesheetGrid.tsx"];

test("every GET form is a FilterForm", () => {
  const stray = filesContaining(/method="get"/).filter((file) => !queryFormFiles.includes(file));
  expect(stray).toEqual([]);
});
