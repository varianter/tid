import { expect, test } from "bun:test";
import type { User } from "../login/user";
import { managesOrganization } from "./manager";

test("no one manages an organization they don't belong to", () => {
  const user = { id: 1, orgId: 1 } as User;
  expect(managesOrganization(user, 2)).toBe(false);
});
