import type { HarvestExport } from "./harvestExport";
import type { Findings, ImportPlan } from "./plan";

export type Person = { email: string; name: string; harvestRoles: Set<string>; slugs: string[] };

// One person is one user across accounts, matched by email ignoring case.
export function mergePeople(harvestExports: HarvestExport[], slugByAccount: Map<number, string>) {
  const people = new Map<string, Person>();
  const emailByHarvestUser = new Map<string, string>();
  for (const { account, users } of harvestExports) {
    const slug = slugByAccount.get(account.id);
    for (const user of users) {
      const key = user.email.toLowerCase();
      const person = people.get(key) ?? {
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        harvestRoles: new Set<string>(),
        slugs: [],
      };
      people.set(key, person);
      for (const role of user.access_roles) person.harvestRoles.add(role);
      if (slug && !person.slugs.includes(slug)) person.slugs.push(slug);
      emailByHarvestUser.set(`${account.id}:${user.id}`, key);
    }
  }
  return { people, emailByHarvestUser };
}

// Harvest can't tell which organization a person belongs to, so it's where they work the
// most: assigned to the most projects, then logging the most time.
export function placeUsers(
  people: Map<string, Person>,
  assignments: { email: string; slug: string | undefined }[],
  loggedTime: { email: string; slug: string | undefined; minutes: number }[],
  { warnings }: Findings,
) {
  const work = new Map<string, { assignments: number; minutes: number }>();
  const workIn = (email: string, slug: string | undefined) => {
    const key = `${email}|${slug}`;
    if (!work.has(key)) work.set(key, { assignments: 0, minutes: 0 });
    return work.get(key) as { assignments: number; minutes: number };
  };
  for (const { email, slug } of assignments) workIn(email, slug).assignments++;
  for (const { email, slug, minutes } of loggedTime) workIn(email, slug).minutes += minutes;

  const users: ImportPlan["users"] = [];
  const organizationByEmail = new Map<string, string>();
  for (const [key, person] of people) {
    const bySlug = person.slugs
      .map((slug) => ({ slug, ...workIn(key, slug) }))
      .toSorted((a, b) => b.assignments - a.assignments || b.minutes - a.minutes);
    const [chosen] = bySlug;
    if (!chosen) continue;
    organizationByEmail.set(key, chosen.slug);
    if (bySlug.length > 1) {
      warnings.push(
        `${person.email} is in ${bySlug.map(({ slug }) => slug).join(" and ")}; ` +
          `placed in ${chosen.slug}, where they work the most.`,
      );
    }
    users.push({
      email: person.email,
      name: person.name,
      organization: chosen.slug,
      // Anyone with more than a member's access in some Harvest account manages in Tid, where
      // the role spans organizations.
      manager: [...person.harvestRoles].some((role) => role !== "member"),
      harvestRoles: [...person.harvestRoles],
    });
  }
  return { users, organizationByEmail };
}
