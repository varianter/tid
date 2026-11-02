import { clientAccountManagers, clients, users } from "@tid/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { database } from "../framework/database";

export const findClient = async (idParam: string | undefined) => {
  const id = Number(idParam);
  if (!Number.isSafeInteger(id)) return undefined;
  const [client] = await database.select().from(clients).where(eq(clients.id, id));
  return client;
};

export const isOrganizationNumberTaken = async (
  organizationNumber: string,
  exceptClientId?: number,
) =>
  (await database.$count(
    clients,
    and(
      eq(clients.organizationNumber, organizationNumber),
      exceptClientId === undefined ? undefined : ne(clients.id, exceptClientId),
    ),
  )) > 0;

export const listAccountManagers = (clientId: number) =>
  database
    .select({ id: users.id, name: users.name })
    .from(clientAccountManagers)
    .innerJoin(users, eq(users.id, clientAccountManagers.userId))
    .where(eq(clientAccountManagers.clientId, clientId))
    .orderBy(users.name);
