import { expect, test } from "bun:test";
import { organizationChangeBlockers } from "./organizationChange";

const noHistory = {
  organizationName: "Oslo",
  hasLoggedTime: false,
  assignedProjects: [],
  hasChangedMonthLocks: false,
};

test("someone with no history can change organization", () => {
  expect(organizationChangeBlockers(noHistory)).toEqual([]);
});

test("every kind of history gives its own reason", () => {
  const blockers = organizationChangeBlockers({
    organizationName: "Oslo",
    hasLoggedTime: true,
    assignedProjects: ["Internal (Variant)", "Website (Acme)"],
    hasChangedMonthLocks: true,
  });
  expect(blockers).toHaveLength(3);
  expect(blockers[1]).toContain("Internal (Variant), Website (Acme)");
});
