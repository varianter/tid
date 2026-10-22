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

// ponytail: `.command.tsx` lends its form to other pages until every feature splits it out
// into a `.form.tsx`, like projects/. Then the exception goes.
test("only routers import commands", () => {
  const stray = namedImports.filter(
    ({ file, name, from }) =>
      /\.command\.tsx?$/.test(from) &&
      !file.endsWith(".routes.tsx") &&
      !(from.endsWith(".command.tsx") && name.endsWith("Form")),
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

// ponytail: these did I/O before the rule. Each leaves the list when it's split into a pure file
// and a `.data.ts`, `.middleware.ts` or slice.
const impureFiles = [
  "administration/openProjectChange.ts",
  "administration/organizationMember.ts",
  "assignments/assignment.ts",
  "assignments/repricing.ts",
  "clients/client.ts",
  "consultants/consultantsUrl.ts",
  "consultants/currentBillableProjects.ts",
  "harvestImport/harvestTokens.ts",
  "login/userIdentity.ts",
  "managers/manager.ts",
  "organizations/companyFilter.tsx",
  "organizations/organization.ts",
  "organizations/organizationSelect.tsx",
  "projects/projectCurrency.ts",
  "projects/projectParticipation.ts",
  "projects/projectReport.tsx",
  "projects/projectSummary.tsx",
  "timesheet/loggableTasks.ts",
  "timesheet/monthPage.tsx",
];

test("files without an I/O suffix are pure", () => {
  const stray = impureImports.filter(({ file }) => !impureFiles.includes(file));
  expect(stray.map(({ file, from }) => `${file} imports ${from}`)).toEqual([]);
});

test("the list of impure files only shrinks", () => {
  const nowPure = impureFiles.filter((file) => !impureImports.some((i) => i.file === file));
  expect(nowPure).toEqual([]);
});
