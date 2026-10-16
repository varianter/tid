import { Button, FormField, Page } from "@tid/ui";
import { z } from "zod";
import { type FormProps, formAction } from "../form/formAction";
import { importPath } from "./harvestImportUrl";
import { keepHarvestTokens } from "./harvestTokens";

const enterHarvestTokensForm = z.object({
  tokens: z
    .string()
    .transform((tokens) => tokens.split(/[\s,]+/).filter(Boolean))
    .pipe(z.array(z.string()).min(1, "Paste at least one token.")),
});

export const enterHarvestTokens = formAction({
  schema: enterHarvestTokensForm,
  loader: async () => ({}),
  onSubmit: async (c, { tokens }) => {
    keepHarvestTokens(c, tokens);
    return { redirect: importPath };
  },
  view: HarvestTokensPage,
});

// The tokens are never echoed back, since the field is a password.
function HarvestTokensPage({ fieldErrors }: FormProps) {
  return (
    <Page title="Harvest import">
      <form method="post" class="stack-v nowrap gap-m w-max-5">
        <p class="ink-subtle">
          Paste a Harvest personal access token for each account, separated by commas. They're kept
          in this browser for an hour, and only sent to this page.
        </p>
        <FormField
          name="tokens"
          label="Tokens"
          type="password"
          autocomplete="off"
          errors={fieldErrors?.tokens}
          required
        />
        <Button type="submit" class="w-max-content">
          Continue
        </Button>
      </form>
    </Page>
  );
}
