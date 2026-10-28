import { expect, test } from "bun:test";
import type { User } from "../users/user";
import { managesOrganization } from "./manager";

const manager = { id: 1, orgId: 1, isManager: true } as User;
const member = { id: 2, orgId: 1, isManager: false } as User;

test("a manager manages their own organization", () => {
  expect(managesOrganization(manager, 1)).toBe(true);
});

test("a member doesn't manage their own organization", () => {
  expect(managesOrganization(member, 1)).toBe(false);
});

test("no one manages an organization they don't belong to", () => {
  expect(managesOrganization(manager, 2)).toBe(false);
});
