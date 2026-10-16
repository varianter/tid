import { organizations } from "@tid/db/schema";
import { fetchHarvestAccounts } from "@tid/harvest/fetch";
import { type ImportPlan, planImport, type Warning } from "@tid/harvest/plan";
import { type Difference, describeRejection, writePlan } from "@tid/harvest/write";
import { Badge, Button, Checkbox, ColorMode, DataGrid, Page, type Palette, Select } from "@tid/ui";
import type { Context } from "hono";
import type { Child } from "hono/jsx";
import { z } from "zod";
import { formatAmount } from "../amount/amount";
import { database } from "../database";
import { formatDate } from "../dates/dateDisplay";
import { isIsoDate } from "../dates/isoDate";
import { type FormProps, formAction } from "../form/formAction";
import { billingLabels } from "../projects/billing";
import { ForgetHarvestTokensForm } from "./forgetHarvestTokens.command";
import { importPath, projectImportPath } from "./harvestImportUrl";
import { readHarvestTokens } from "./harvestTokens";
import { groupPreview } from "./importPreview";

const ownerField = "owner.";

const importFromHarvestForm = z
  .looseObject({
    fingerprint: z.string(),
    // One ticked box posts a string, several post an array.
    accept: z
      .union([z.string(), z.array(z.string())])
      .default([])
      .transform((accepted) => new Set([accepted].flat())),
  })
  // Each project without a contract owner posts owner.<code>, empty when none was picked.
  .transform(({ fingerprint, accept, ...fields }) => ({
    fingerprint,
    accept,
    owners: new Map(
      Object.entries(fields).flatMap(([name, slug]) =>
        name.startsWith(ownerField) && typeof slug === "string" && slug !== ""
          ? [[name.slice(ownerField.length), slug] as const]
          : [],
      ),
    ),
  }));

// Ties an import to the plan that was previewed, so Harvest changing in between isn't imported unseen.
const fingerprint = (plan: ImportPlan) => Bun.hash(JSON.stringify(plan)).toString(36);

async function planFromHarvest(tokens: string) {
  // Named by position, so errors can say which token failed without showing it.
  const namedTokens = Object.fromEntries(
    tokens.split(",").map((token, index) => [`token ${index + 1}`, token]),
  );
  const harvestExports = await fetchHarvestAccounts(namedTokens);
  const known = await database.select().from(organizations);
  const currencies = new Map(
    known.map((organization) => [organization.slug, organization.currency]),
  );
  return { ...planImport(harvestExports, known), currencies };
}

async function preview(tokens: string) {
  try {
    const { plan, problems, warnings, currencies } = await planFromHarvest(tokens);
    if (problems.length > 0) return { problems, warnings };
    const { added, differences, ownerless } = await writePlan(database, plan, { preview: true });
    return {
      problems,
      warnings,
      plan,
      additions: groupPreview(plan, added, currencies),
      differences,
      ownerless: plan.projects.filter((project) => ownerless.includes(project.code)),
      fingerprint: fingerprint(plan),
    };
  } catch (error) {
    return { error: describeRejection(error) };
  }
}

const isNotice = (value?: string): value is Notice => value === "applied" || value === "changed";

export const importFromHarvest = formAction({
  schema: importFromHarvestForm,
  loader: async (c: Context) => {
    const tokens = readHarvestTokens(c);
    if (!tokens) return c.redirect(`${importPath}/tokens`);
    const notice = c.req.query("notice");
    return { ...(await preview(tokens)), notice: isNotice(notice) ? notice : undefined };
  },
  onSubmit: async (
    _c,
    { fingerprint, accept, owners },
    { plan, fingerprint: previewed, error },
  ) => {
    if (error) return { formError: error };
    if (!plan || fingerprint !== previewed)
      return { redirect: `${projectImportPath}?notice=changed` };
    try {
      await writePlan(database, plan, { accepted: accept, owners });
    } catch (rejection) {
      return { formError: describeRejection(rejection) };
    }
    return { redirect: `${projectImportPath}?notice=applied` };
  },
  view: HarvestImportPage,
});

const notices = {
  applied: {
    palette: "green",
    message: "Imported. What's left below is what Tid still has differently.",
  },
  changed: {
    palette: "yellow",
    message: "Harvest changed after your preview, so nothing was imported. Check it again.",
  },
} satisfies Record<string, { palette: Palette; message: string }>;

type Notice = keyof typeof notices;

type Additions = ReturnType<typeof groupPreview>;

function HarvestImportPage({
  notice,
  formError,
  error,
  problems = [],
  warnings = [],
  additions,
  differences = [],
  ownerless = [],
  fingerprint,
}: {
  notice?: Notice;
  plan?: ImportPlan;
  error?: string;
  problems?: string[];
  warnings?: Warning[];
  additions?: Additions;
  differences?: Difference[];
  ownerless?: ImportPlan["projects"];
  fingerprint?: string;
} & FormProps) {
  const hasAdditions = additions && (additions.users.length > 0 || additions.clients.length > 0);
  const hasChoices = hasAdditions || differences.length > 0 || ownerless.length > 0;
  return (
    <Page title="Import users, projects and tasks" actions={<ForgetHarvestTokensForm />}>
      {notice && <Banner palette={notices[notice].palette}>{notices[notice].message}</Banner>}
      {formError && (
        <Banner palette="coral" title="Nothing was imported">
          <Preformatted text={formError} />
        </Banner>
      )}
      {error && (
        <Banner palette="coral" title="Harvest couldn't be imported">
          <Preformatted text={error} />
        </Banner>
      )}
      {problems.length > 0 && (
        <Banner palette="coral" title="Fix these in Harvest first">
          <List items={problems} />
        </Banner>
      )}
      {warnings.length > 0 && <Warnings warnings={warnings} />}

      {fingerprint && additions && (
        <form method="post" action={projectImportPath} class="stack-v nowrap gap-xl">
          <input type="hidden" name="fingerprint" value={fingerprint} />
          {!hasChoices && <p class="ink-subtle">Tid already has everything in Harvest.</p>}
          {additions.users.length > 0 && <NewUsers groups={additions.users} />}
          {additions.clients.length > 0 && <NewProjects clients={additions.clients} />}
          {ownerless.length > 0 && <ContractOwners projects={ownerless} />}
          {differences.length > 0 && <Differences differences={differences} />}
          {hasChoices && (
            <Button type="submit" data-variant="tinted" class="w-max-content">
              Import
            </Button>
          )}
        </form>
      )}
    </Page>
  );
}

type WarningGroup<Kind extends Warning["kind"]> = {
  title: string;
  consequence: string;
  headers: string[];
  cells: (warning: Extract<Warning, { kind: Kind }>) => Child[];
};

// In the order they're shown, most likely to need action first.
const warningGroups: { [Kind in Warning["kind"]]: WarningGroup<Kind> } = {
  noRatePricedByTask: {
    title: "No rate, since the project is billed per task",
    consequence:
      "Their hours export without an amount until a rate is set in Tid. Consider changing the " +
      "project in Harvest from task-based rates to a rate per consultant on the project.",
    headers: ["Person", "Client", "Project"],
    cells: (warning) => [warning.email, warning.client, warning.project],
  },
  noRate: {
    title: "No rate",
    consequence:
      "Harvest has no rate for them on the project, so their hours export without an amount. " +
      "Set their rate in Harvest, or in Tid after the import.",
    headers: ["Person", "Client", "Project"],
    cells: (warning) => [warning.email, warning.client, warning.project],
  },
  ratesNotRising: {
    title: "Rates that aren't a price increase",
    consequence:
      "Billed at rates that went down or were used side by side. They keep the last one.",
    headers: ["Person", "Project", "Billed at", "Keeps"],
    cells: (warning) => [warning.email, warning.project, warning.rates.join(", "), warning.kept],
  },
  severalOrganizations: {
    title: "In several organizations",
    consequence: "Placed in the organization where they work the most.",
    headers: ["Person", "Harvest accounts", "Placed in"],
    cells: (warning) => [warning.email, warning.organizations.join(", "), warning.placedIn],
  },
  sharedName: {
    title: "Projects sharing a name",
    consequence: "A client's project names must differ, so each gets its code added.",
    headers: ["Client", "Name", "Projects"],
    cells: (warning) => [warning.client, warning.name, warning.projects.join(", ")],
  },
  nonBillableEntries: {
    title: "Non-billable time on billable projects",
    consequence: "Tid sets billing per project, so this time exports as billable.",
    headers: ["Project", "Entries"],
    cells: (warning) => [warning.project, warning.entries],
  },
  mixedRatedEntries: {
    title: "Rated and unrated time on the same day",
    consequence: "Merged into one entry, which keeps the rate.",
    headers: ["Person", "Project", "Task", "Day"],
    cells: (warning) => [warning.email, warning.project, warning.task, formatDate(warning.day)],
  },
};

function Warnings({ warnings }: { warnings: Warning[] }) {
  const byKind = Map.groupBy(warnings, (warning) => warning.kind);
  return (
    <section class="stack-v nowrap gap-s">
      <h2 class="fs-l fw-bold">Warnings</h2>
      <p class="ink-subtle">These don't stop the import, but are worth checking.</p>
      {(Object.keys(warningGroups) as Warning["kind"][]).map((kind) => {
        const group = warningGroups[kind] as WarningGroup<Warning["kind"]>;
        const rows = byKind.get(kind) ?? [];
        if (rows.length === 0) return null;
        return (
          <ColorMode palette="yellow" class="d-block surface-tinted br-l p-m stack-v nowrap gap-xs">
            <h3 class="fs-m fw-bold">
              {group.title} <span class="ink-subtle">· {rows.length}</span>
            </h3>
            <p class="fs-s ink-subtle">{group.consequence}</p>
            <DataGrid columns={group.headers.map((label) => ({ label }))}>
              {rows.map((warning) => (
                <DataGrid.Row>{group.cells(warning)}</DataGrid.Row>
              ))}
            </DataGrid>
          </ColorMode>
        );
      })}
    </section>
  );
}

function NewUsers({ groups }: { groups: Additions["users"] }) {
  const users = groups.flatMap(([, users]) => users);
  return (
    <section class="stack-v nowrap gap-s">
      <h2 class="fs-l fw-bold">
        New users <span class="ink-subtle">· {users.length}</span>
      </h2>
      <DataGrid
        columns={[
          { label: "Name" },
          { label: "Email" },
          { label: "Organization" },
          { label: "Role", kind: "fit" },
        ]}
      >
        {users.map((user) => (
          <DataGrid.Row>
            <DataGrid.Title>{user.name}</DataGrid.Title>
            {user.email}
            {user.organization}
            {user.manager ? <Badge palette="green">Manager</Badge> : ""}
          </DataGrid.Row>
        ))}
      </DataGrid>
    </section>
  );
}

// Everything under a new client or project is new too, so only rows added to something Tid
// already has are marked.
function NewProjects({ clients }: { clients: Additions["clients"] }) {
  return (
    <section class="stack-v nowrap gap-l">
      <h2 class="fs-l fw-bold">New clients, projects, tasks and people</h2>
      {clients.map((client) => (
        <section class="stack-v nowrap gap-s">
          <h3 class="stack-h items-center gap-xs fs-m fw-bold">
            {client.name}
            {client.isNew && <NewBadge />}
            <span class="ink-subtle fw-medium">
              · {client.projects.length} {client.projects.length === 1 ? "project" : "projects"}
            </span>
          </h3>
          {client.projects.map((project) => (
            <ProjectAdditions project={project} marksNew={!client.isNew} />
          ))}
        </section>
      ))}
    </section>
  );
}

function ProjectAdditions({
  project,
  marksNew,
}: {
  project: Additions["clients"][number]["projects"][number];
  marksNew: boolean;
}) {
  const marksRows = marksNew && !project.isNew;
  // A long list of tasks Tid already has would hide the new ones.
  const shownTasks = marksRows ? project.tasks.filter((task) => task.isNew) : project.tasks;
  const existingTasks = project.tasks.length - shownTasks.length;
  const billing = project.openToEveryone ? "Open to everyone" : billingLabels[project.billing];
  return (
    <article class="stack-v nowrap gap-2xs b-all bc-subtle br-l p-s fs-s">
      <header class="stack-h items-center gap-xs">
        <span class="fw-bold">{project.code}</span>
        <span class="fw-medium">{project.name}</span>
        {marksNew && project.isNew && <NewBadge />}
      </header>
      <p class="ink-subtle">
        {billing} ·{" "}
        {project.organizations
          .map(({ slug, isNew }) => (marksRows && isNew ? `${slug} (new)` : slug))
          .join(", ")}
      </p>
      {shownTasks.length > 0 && (
        <p>
          <span class="ink-subtle">{marksRows ? "New tasks: " : "Tasks: "}</span>
          {shownTasks.map((task) => task.name).join(", ")}
          {existingTasks > 0 && <span class="ink-subtle"> · {existingTasks} already in Tid</span>}
        </p>
      )}
      {project.people.length > 0 && (
        <div
          class="d-grid gap-column-l lh-snug"
          style="grid-template-columns: repeat(3, max-content);"
        >
          {project.people.map((person) => (
            <div class="grid-all-columns grid-subgrid items-center">
              <span>
                {person.name} {marksRows && person.isNew && <NewBadge />}
              </span>
              <span class="ta-right t-tabular">
                {person.rate ? (
                  formatAmount(person.rate.rate / 100, person.rate.currency, 2)
                ) : (
                  <span class="ink-subtle">No rate</span>
                )}
                {marksRows && !person.isNew && person.rate?.isNew && " (new)"}
              </span>
              <span class="ink-subtle">
                {person.rate && `from ${formatDate(person.rate.validFrom)}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

// Harvest doesn't know who invoices the client, so someone picks it. Suggestions come from the
// Harvest codes; see the Harvest import README.
function ContractOwners({ projects }: { projects: ImportPlan["projects"] }) {
  return (
    <section class="stack-v nowrap gap-s">
      <h2 class="fs-l fw-bold">
        No contract owner <span class="ink-subtle">· {projects.length}</span>
      </h2>
      <p class="ink-subtle">
        Pick the organization that invoices the client, or leave it for later and pick it when
        editing the project.
      </p>
      <DataGrid
        columns={[
          { label: "Project" },
          { label: "Client" },
          { label: "Harvest codes" },
          { label: "Contract owner", kind: "fit" },
        ]}
      >
        {projects.map((project) => (
          <DataGrid.Row>
            <DataGrid.Title secondary={project.name}>{project.code}</DataGrid.Title>
            {project.client}
            {project.harvestProjects
              .map((part) => `${part.code} (${part.organization})`)
              .join(", ")}
            <Select
              name={`${ownerField}${project.code}`}
              aria-label={`Contract owner of ${project.code}`}
            >
              <option value="">None</option>
              {project.organizations.map((slug) => (
                <option value={slug} selected={slug === project.suggestedOwner}>
                  {slug}
                </option>
              ))}
            </Select>
          </DataGrid.Row>
        ))}
      </DataGrid>
    </section>
  );
}

const fieldNames: Record<string, string> = {
  openToMembers: "open to members",
  countsTowardBillableBase: "counts toward billable base",
  startsOn: "starts on",
  endsOn: "ends on",
};

function describeValue(value: string | null) {
  if (value === null) return "–";
  if (value === "true") return "yes";
  if (value === "false") return "no";
  return isIsoDate(value) ? formatDate(value) : value;
}

function Differences({ differences }: { differences: Difference[] }) {
  return (
    <section class="stack-v nowrap gap-s">
      <h2 class="fs-l fw-bold">Different in Tid</h2>
      <p class="ink-subtle">Tid keeps its value unless you tick Use Harvest.</p>
      <DataGrid
        columns={[
          { label: "Use Harvest", kind: "fit" },
          { label: "Row" },
          { label: "Tid" },
          { label: "Harvest" },
        ]}
      >
        {differences.map((difference, index) => (
          <DataGrid.Row for={`accept-${index}`}>
            <Checkbox id={`accept-${index}`} name="accept" value={difference.id} />
            <DataGrid.Title secondary={fieldNames[difference.field] ?? difference.field}>
              {difference.kind} {difference.row}
            </DataGrid.Title>
            {describeValue(difference.tid)}
            {describeValue(difference.harvest)}
          </DataGrid.Row>
        ))}
      </DataGrid>
    </section>
  );
}

function Banner({
  palette,
  title,
  children,
}: {
  palette: Palette;
  title?: string;
  children: Child;
}) {
  return (
    <ColorMode
      palette={palette}
      class="d-block surface-dyed b-all bc-subtle br-l p-m stack-v nowrap gap-xs"
    >
      {title && <h2 class="fs-m fw-bold">{title}</h2>}
      {title ? children : <p class="fw-medium">{children}</p>}
    </ColorMode>
  );
}

const NewBadge = () => <Badge palette="green">New</Badge>;

function Preformatted({ text }: { text: string }) {
  return (
    <p class="fs-s" style="white-space: pre-wrap;">
      {text}
    </p>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul class="stack-v nowrap gap-3xs fs-s pl-m">
      {items.map((item) => (
        <li>{item}</li>
      ))}
    </ul>
  );
}
