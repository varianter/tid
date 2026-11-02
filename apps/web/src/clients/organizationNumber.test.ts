import { expect, test } from "bun:test";
import {
  countryOf,
  formatOrganizationNumber,
  organizationNumberDigits,
} from "./organizationNumber";

const read = (typed: string) => organizationNumberDigits.safeParse(typed).data;

test("an organization number is read as digits, however it's typed", () => {
  expect(read("974 760 673")).toBe("974760673");
  expect(read("NO 974 760 673 MVA")).toBe("974760673");
  expect(read("556012-5790")).toBe("5560125790");
  expect(read("5560125790")).toBe("5560125790");
});

test("an organization number has 9 digits in Norway and 10 in Sweden", () => {
  expect(countryOf("974760673")).toBe("NO");
  expect(countryOf("5560125790")).toBe("SE");
  expect(read("97476067")).toBeUndefined();
  expect(read("55601257901")).toBeUndefined();
});

test("an organization number is shown the way its country writes it", () => {
  for (const written of ["974 760 673", "556012-5790"])
    expect(formatOrganizationNumber(organizationNumberDigits.parse(written))).toBe(written);
});
