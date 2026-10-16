import { Button } from "@tid/ui";
import type { Context } from "hono";
import { importPath } from "./harvestImportUrl";
import { deleteHarvestTokens } from "./harvestTokens";

export const forgetHarvestTokens = (c: Context) => {
  deleteHarvestTokens(c);
  return c.redirect(importPath, 303);
};

export function ForgetHarvestTokensForm() {
  return (
    <form method="post" action={`${importPath}/forget`}>
      <Button type="submit" data-variant="plain">
        Forget tokens
      </Button>
    </form>
  );
}
