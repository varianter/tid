import { Checkbox, DataGrid, EmptyState, FormPage } from "@tid/ui";
import { z } from "zod";
import {
  type OrganizationFilter,
  OrganizationSelect,
} from "../domain/organizations/organizationFilter";
import type { User } from "../domain/users/user";
import { Filtered } from "../framework/filter";
import type { FormState } from "../framework/formAction";
import { checkboxArray } from "../framework/formValues";
import { administrationPath, openProjectsPath } from "./administration.url";
import { OtherOrganizationNotice } from "./otherOrganizationNotice";

export const chooseOpenProjectsForm = z.object({
  projectId: z.preprocess(checkboxArray, z.array(z.coerce.number().int())),
});

export type OpenableProject = {
  id: number;
  name: string;
  code: string;
  client: string;
  open: boolean;
};

type ChooseOpenProjectsFormPageProps = {
  organization: User["organization"];
  projects: OpenableProject[];
  filter: OrganizationFilter;
  own: User["organization"];
  form: FormState<typeof chooseOpenProjectsForm>;
};

export function ChooseOpenProjectsFormPage({
  organization,
  projects,
  filter,
  own,
  form,
}: ChooseOpenProjectsFormPageProps) {
  const clients = Map.groupBy(projects, (project) => project.client);
  return (
    <FormPage
      title={`Projects open to everyone in ${organization.name}`}
      filters={
        <Filtered by={<OrganizationSelect {...filter} />}>
          <OtherOrganizationNotice
            current={organization}
            own={own}
            back={openProjectsPath(own.slug)}
          />
        </Filtered>
      }
      cancel={administrationPath}
      submit={projects.length === 0 ? undefined : "Save"}
      form={form}
      layer="drawer"
    >
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
    </FormPage>
  );
}
