import { formatDate } from "@tid/calendar/dateDisplay";
import { Checkbox, DataGrid, FormError, FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";

// One ticked box comes as a string, several as an array, none as nothing.
export const assignConsultantsForm = z.object({
  userId: z.preprocess(
    (value) => (value === undefined ? [] : [value].flat()),
    z.array(z.coerce.number().int()).min(1, "Choose at least one consultant"),
  ),
});

type AssignablePerson = {
  id: number;
  name: string;
  orgName: string;
  /** Set when they were on the project before. */
  leftProjectOn: string | null;
};

type AssignConsultantsFormPageProps = {
  project: { id: number; name: string };
  /** Sorted by organization, so they group. */
  people: AssignablePerson[];
  form: FormState<typeof assignConsultantsForm>;
};

export function AssignConsultantsFormPage({
  project,
  people,
  form,
}: AssignConsultantsFormPageProps) {
  const organizations = Map.groupBy(people, (person) => person.orgName);
  return (
    <FormPage
      title={`Assign consultants to ${project.name}`}
      cancel={`/projects/${project.id}`}
      submit={people.length === 0 ? undefined : "Assign"}
      form={form}
      layer="drawer"
    >
      {people.length === 0 ? (
        <p class="ink-subtle">Everyone is assigned already.</p>
      ) : (
        <div class="w-full">
          {form.fieldErrors.userId && (
            <FormError id="userId-error" errors={form.fieldErrors.userId} />
          )}
          <DataGrid columns={[{ kind: "fit" }, { label: "Consultant" }]}>
            {[...organizations].map(([orgName, orgPeople]) => (
              <>
                <DataGrid.Group>{orgName}</DataGrid.Group>
                {orgPeople.map((person) => (
                  <DataGrid.Row for={`consultant-${person.id}`}>
                    <Checkbox
                      id={`consultant-${person.id}`}
                      name="userId"
                      value={String(person.id)}
                    />
                    <DataGrid.Title
                      secondary={
                        person.leftProjectOn &&
                        `Left project ${formatDate(person.leftProjectOn, "numeric")}`
                      }
                    >
                      {person.name}
                    </DataGrid.Title>
                  </DataGrid.Row>
                ))}
              </>
            ))}
          </DataGrid>
        </div>
      )}
    </FormPage>
  );
}
