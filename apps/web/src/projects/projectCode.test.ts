import { expect, test } from "bun:test";
import { suggestProjectCode } from "./projectCode";

test("suggestProjectCode continues the client's prefix", () => {
  expect(suggestProjectCode("Tet Digital", ["TET1001", "TET1005"], ["TET1001", "TET1005"])).toBe(
    "TET1006",
  );
  expect(suggestProjectCode("Varianttid", ["VAR1000", "SYK1000", "VAR2000"], ["VAR2000"])).toBe(
    "VAR2001",
  );
});

test("suggestProjectCode starts a new client from its name, past codes already taken", () => {
  expect(suggestProjectCode("Élan AS", [], [])).toBe("ELA1000");
  expect(suggestProjectCode("Telia", [], ["TEL1000"])).toBe("TEL1001");
  expect(suggestProjectCode("1881", [], [])).toBeUndefined();
});
