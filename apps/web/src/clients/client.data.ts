import { clients } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { database } from "../framework/database";

export const findClient = async (idParam: string | undefined) => {
  const id = Number(idParam);
  if (!Number.isSafeInteger(id)) return undefined;
  const [client] = await database.select().from(clients).where(eq(clients.id, id));
  return client;
};
