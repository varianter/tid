import type { HarvestExport } from "./plan";

type HarvestAccount = { id: number; name: string; product: string };

class HarvestClient {
  constructor(
    readonly tokenName: string,
    private readonly token: string,
  ) {}

  // biome-ignore lint/suspicious/noExplicitAny: raw Harvest JSON, typed where it's used.
  async get(url: string, accountId?: number): Promise<any> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "tid harvest import",
        ...(accountId && { "Harvest-Account-Id": String(accountId) }),
      },
    });
    if (!response.ok) {
      throw new Error(
        `Harvest answered ${response.status} to ${this.tokenName} for ${url}: ${await response.text()}`,
      );
    }
    return response.json();
  }

  // Harvest pages list endpoints; the key holding the rows matches the resource name.
  async getAllPages(resource: string, accountId: number, query = "") {
    const rows: unknown[] = [];
    let url: string | null = `https://api.harvestapp.com/v2/${resource}?per_page=2000${query}`;
    while (url) {
      const page = await this.get(url, accountId);
      rows.push(...page[resource]);
      url = page.links.next;
    }
    return rows;
  }
}

async function fetchAccount(
  client: HarvestClient,
  account: HarvestAccount,
  from: string,
  to: string,
): Promise<HarvestExport> {
  const timeEntries = (await client.getAllPages(
    "time_entries",
    account.id,
    `&from=${from}&to=${to}`,
  )) as HarvestExport["timeEntries"];
  const loggingUserIds = new Set(timeEntries.map((entry) => entry.user.id));
  const loggedProjectIds = new Set(timeEntries.map((entry) => entry.project.id));
  // Active ones are needed from day one; inactive ones only for the history they logged.
  const users = ((await client.getAllPages("users", account.id)) as HarvestExport["users"]).filter(
    (user) => user.is_active || loggingUserIds.has(user.id),
  );
  const projects = (
    (await client.getAllPages("projects", account.id)) as HarvestExport["projects"]
  ).filter((project) => project.is_active || loggedProjectIds.has(project.id));
  const userAssignments = (await client.getAllPages(
    "user_assignments",
    account.id,
    "&is_active=true",
  )) as HarvestExport["userAssignments"];
  const taskAssignments = (await client.getAllPages(
    "task_assignments",
    account.id,
    "&is_active=true",
  )) as HarvestExport["taskAssignments"];
  return {
    account: { id: account.id, name: account.name },
    users,
    projects,
    userAssignments,
    taskAssignments,
    timeEntries,
  };
}

// Every account the tokens can reach, once each, since several tokens may share an account.
export async function fetchHarvestAccounts(
  tokens: Record<string, string>,
  from: string,
  to: string,
) {
  const accounts = new Map<number, { client: HarvestClient; account: HarvestAccount }>();
  for (const [tokenName, token] of Object.entries(tokens)) {
    const client = new HarvestClient(tokenName, token);
    const { accounts: reachable } = (await client.get(
      "https://id.getharvest.com/api/v2/accounts",
    )) as { accounts: HarvestAccount[] };
    for (const account of reachable.filter((account) => account.product === "harvest")) {
      if (!accounts.has(account.id)) accounts.set(account.id, { client, account });
    }
  }
  return Promise.all(
    [...accounts.values()].map(({ client, account }) => fetchAccount(client, account, from, to)),
  );
}
