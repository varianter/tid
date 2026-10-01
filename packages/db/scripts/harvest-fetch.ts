// Saves one month of raw Harvest data per account, so the import mapping can be worked out
// against real data. Usage: HARVEST_TOKEN=... bun scripts/harvest-fetch.ts 2026-08

const token = process.env.HARVEST_TOKEN;
if (!token) throw new Error("HARVEST_TOKEN is not set");

const month = process.argv[2];
if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new Error("Pass a month as YYYY-MM");

const [year, monthNumber] = month.split("-").map(Number) as [number, number];
const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
const from = `${month}-01`;
const to = `${month}-${lastDay}`;

const outputDirectory = `${import.meta.dir}/../harvest-export/${month}`;

type HarvestAccount = { id: number; name: string; product: string };

// biome-ignore lint/suspicious/noExplicitAny: raw Harvest JSON, saved as-is.
async function fetchHarvest(url: string, accountId?: number): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "tid harvest import",
      ...(accountId && { "Harvest-Account-Id": String(accountId) }),
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}: ${await response.text()}`);
  return response.json();
}

// Harvest pages list endpoints; the key holding the rows matches the resource name.
async function fetchAllPages(resource: string, accountId: number, query = "") {
  const rows: unknown[] = [];
  let url: string | null = `https://api.harvestapp.com/v2/${resource}?per_page=2000${query}`;
  while (url) {
    const page = await fetchHarvest(url, accountId);
    rows.push(...page[resource]);
    url = page.links.next;
  }
  return rows;
}

const { accounts } = (await fetchHarvest("https://id.getharvest.com/api/v2/accounts")) as {
  accounts: HarvestAccount[];
};

for (const account of accounts.filter((account) => account.product === "harvest")) {
  const timeEntries = (await fetchAllPages(
    "time_entries",
    account.id,
    `&from=${from}&to=${to}`,
  )) as { user: { id: number }; project: { id: number } }[];
  const loggingUserIds = new Set(timeEntries.map((entry) => entry.user.id));
  const loggedProjectIds = new Set(timeEntries.map((entry) => entry.project.id));
  // Time entries only carry user names; emails are how users are matched.
  const users = ((await fetchAllPages("users", account.id)) as { id: number }[]).filter((user) =>
    loggingUserIds.has(user.id),
  );
  // Time entries lack the project's billing type and dates.
  const projects = ((await fetchAllPages("projects", account.id)) as { id: number }[]).filter(
    (project) => loggedProjectIds.has(project.id),
  );

  await Bun.write(
    `${outputDirectory}/${account.id}.json`,
    JSON.stringify({ account, users, projects, timeEntries }, null, 2),
  );
  console.log(
    `${account.name}: ${timeEntries.length} entries, ${users.length} users, ${projects.length} projects`,
  );
}
