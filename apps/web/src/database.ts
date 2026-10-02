import { WorkloadIdentityCredential } from "@azure/identity";
import { createDatabase } from "@tid/db/client";
import { SQL } from "bun";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const POSTGRES_AAD_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";

// AZURE_CLIENT_ID = pod has workload identity. URL has no password then, get
// Entra token instead. Fetch fresh token per connect, token only lives ~1h,
// no caching here (SDK caches internally anyway).
async function fetchPostgresToken(credential: WorkloadIdentityCredential) {
  const token = await credential.getToken(POSTGRES_AAD_SCOPE);
  if (!token) throw new Error("no azure AD token for postgres, workload identity broken?");
  return token.token;
}

function connection(url: string) {
  if (!process.env.AZURE_CLIENT_ID) return url;
  const credential = new WorkloadIdentityCredential();
  return new SQL(url, { password: () => fetchPostgresToken(credential) });
}

export const database = createDatabase(connection(databaseUrl));
