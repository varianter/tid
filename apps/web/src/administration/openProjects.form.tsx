import { Button, Checkbox, DataGrid, EmptyState, Page } from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";
import type { OrganizationOption } from "../organizations/organizationSelect";
import { administrationPath } from "./administrationUrl";
import { OrganizationSwitcher, OtherOrganizationNotice } from "./organizationSwitch";

// One ticked box comes as a string, several as an array, none as nothing.
export const openProjectsForm = z.object({
  projectId: z.preprocess(
    (value) => (value === undefined ? [] : [value].flat()),
    z.array(z.coerce.number().int()),
  ),
});

export type OpenableProject = {
  id: number;
  name: string;
  code: string;
  client: string;
  open: boolean;
};

type OpenProjectsPageProps = {
  organization: { slug: string; name: string };
  projects: OpenableProject[];
  organizations: OrganizationOption[];
  ownOrgId: number;
} & FormProps;

export function OpenProjectsPage({
  organization,
  projects,
  organizations,
  ownOrgId,
}: OpenProjectsPageProps) {
  const clients = Map.groupBy(projects, (project) => project.client);
  return (
    <Page
      title={`Projects open to everyone in ${organization.name}`}
      back={{ href: administrationPath(organization.slug), label: "Administration" }}
      actions={<OrganizationSwitcher organizations={organizations} current={organization} />}
    >
      <OtherOrganizationNotice
        organizations={organizations}
        current={organization}
        ownOrgId={ownOrgId}
      />
      {projects.length === 0 ? (
        <EmptyState emoji="🔓" title="No non-billable projects">
          Only non-billable projects can be open to everyone.
        </EmptyState>
      ) : (
        <form method="post" class="stack-v items-start gap-m">
          <DataGrid columns={[{ kind: "fit" }, { label: "Project" }]}>
            {[...clients].map(([client, clientProjects]) => (
              <>
                <DataGrid.Group>{client}</DataGrid.Group>
                {clientProjects.map((project) => (
                  <DataGrid.Row for={`project-${project.id}`}>
                    <Checkbox
                      id={`project-${project.id}`}
                      name="projectId"
                      value={String(project.id)}
                      checked={project.open}
                    />
                    <DataGrid.Title secondary={project.code}>{project.name}</DataGrid.Title>
                  </DataGrid.Row>
                ))}
              </>
            ))}
          </DataGrid>
          <Button type="submit">Save</Button>
        </form>
      )}
    </Page>
  );
}
