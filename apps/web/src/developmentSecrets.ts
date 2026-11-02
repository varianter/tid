import { AzureCliCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

// Production gets these through values.yaml in infrastructure-as-code. A new secret goes in
// both Key Vaults, in values.yaml and here.
const vaultUrl = "https://kv-workloads-dev-ne.vault.azure.net";
const secretNameByVariable: Record<string, string> = {
  ALTINN_LOOKUP_NORDICINFORMATION_API_KEY: "tid-altinn-lookup-api-key",
};

/**
 * Reads the secrets as whoever is signed in with `az login`, so they're kept in memory and never
 * written to disk. Most pages work without them, so a failure warns rather than stopping dev.
 */
export async function readDevelopmentSecrets() {
  const client = new SecretClient(vaultUrl, new AzureCliCredential());
  try {
    const entries = await Promise.all(
      Object.entries(secretNameByVariable).map(async ([variable, secretName]) => {
        const secret = await client.getSecret(secretName);
        return [variable, secret.value] as const;
      }),
    );
    return Object.fromEntries(entries);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Could not read secrets from ${vaultUrl}, so features that need them won't work.`);
    console.warn(`${reason}\nRun \`az login\` and restart to fix it.`);
    return {};
  }
}
