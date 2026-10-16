import { Page } from "@tid/ui";
import type { Context } from "hono";
import { ForgetHarvestTokensForm } from "./forgetHarvestTokens.command";
import { importPath, projectImportPath } from "./harvestImportUrl";
import { readHarvestTokens } from "./harvestTokens";

const imports = [
  {
    path: projectImportPath,
    title: "Users, projects and tasks",
    description: "Clients, projects, tasks, the people on them and their rates.",
  },
];

export const harvestImportList = (c: Context) => {
  if (!readHarvestTokens(c)) return c.redirect(`${importPath}/tokens`);
  return c.render(<HarvestImportListPage />);
};

function HarvestImportListPage() {
  return (
    <Page title="Harvest import" actions={<ForgetHarvestTokensForm />}>
      <ul class="stack-v nowrap gap-m">
        {imports.map(({ path, title, description }) => (
          <li class="stack-v nowrap gap-3xs">
            <a href={path} class="fw-medium">
              {title}
            </a>
            <span class="fs-s ink-subtle">{description}</span>
          </li>
        ))}
      </ul>
    </Page>
  );
}
