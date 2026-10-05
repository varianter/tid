import { expect, test } from "bun:test";
import { errorReport } from "./errorReport";

test("errorReport follows the cause chain and includes own properties", () => {
  const postgres = Object.assign(new Error("duplicate key"), { code: "23505", detail: "taken" });
  const failure = new Error("Failed query", { cause: postgres });
  const report = errorReport(failure);
  expect(report).toContain("Failed query");
  expect(report).toContain("Caused by: ");
  expect(report).toContain("duplicate key");
  expect(report).toContain('"code": "23505"');
});

test("errorReport survives cycles and thrown values that aren't errors", () => {
  const first = new Error("first");
  const second = new Error("second", { cause: first });
  first.cause = second;
  expect(errorReport(first)).toContain("second");
  expect(errorReport("oops")).toContain("oops");
});

test("errorReport shows a cause assigned as a property only once", () => {
  const failure = new Error("Failed query");
  Object.assign(failure, { cause: new Error("duplicate key") });
  expect(errorReport(failure).match(/duplicate key/g)).toHaveLength(1);
});
