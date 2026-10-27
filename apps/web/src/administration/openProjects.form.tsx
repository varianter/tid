import { Checkbox, DataGrid, EmptyState } from "@tid/ui";
import { z } from "zod";
import type { OrganizationOption } from "../domain/organizations/organization";
import type { FormProps } from "../framework/formAction";
import { administrationPath } from "./administration.url";
import { OtherOrganizationNotice } from "./organizationSwitch";

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

type OpenProjectsProps = {
  organization: { slug: string; name: string };
  projects: OpenableProject[];
  organizations: OrganizationOption[];
  ownOrgId: number;
};

export const openProjectsFrame = ({ organization, projects }: OpenProjectsProps) => ({
  title: `Projects open to everyone in ${organization.name}`,
  cancel: administrationPath(organization.slug),
  submit: projects.length === 0 ? undefined : "Save",
});

export function OpenProjectsFields({
  organization,
  projects,
  organizations,
  ownOrgId,
}: OpenProjectsProps & FormProps) {
  const clients = Map.groupBy(projects, (project) => project.client);
  return (
    <>
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
      )}
    </>
  );
}
