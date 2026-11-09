/**
 * Changing a consultant's organization only fixes a wrong choice at sign-up. Hours are reported
 * under the organization of whoever logged them, so once there's history the change would move it.
 */
export type OrganizationChangeFacts = {
  organizationName: string;
  hasLoggedTime: boolean;
  assignedProjects: string[];
  hasChangedMonthLocks: boolean;
};

/** Why the consultant can't change organization. Empty when they can. */
export function organizationChangeBlockers({
  organizationName,
  hasLoggedTime,
  assignedProjects,
  hasChangedMonthLocks,
}: OrganizationChangeFacts): string[] {
  return [
    hasLoggedTime && `They've logged time, which is reported under ${organizationName}.`,
    assignedProjects.length > 0 &&
      `They're assigned to ${assignedProjects.join(", ")}. End those assignments first.`,
    hasChangedMonthLocks && `They've locked or unlocked months for ${organizationName}.`,
  ].filter((blocker) => typeof blocker === "string");
}
