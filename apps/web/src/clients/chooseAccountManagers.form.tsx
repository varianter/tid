import { Checkbox, DataGrid, FormError, FormPage } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";
import { checkboxArray } from "../framework/formValues";
import type { Client } from "./client";

export const chooseAccountManagersForm = z.object({
  userId: z.preprocess(checkboxArray, z.array(z.coerce.number().int())),
});

type CandidateAccountManager = {
  id: number;
  name: string;
  orgName: string;
  chosen: boolean;
};

type ChooseAccountManagersFormPageProps = {
  client: Client;
  /** Sorted by organization, so they group. */
  people: CandidateAccountManager[];
  form: FormState<typeof chooseAccountManagersForm>;
};

export function ChooseAccountManagersFormPage({
  client,
  people,
  form,
}: ChooseAccountManagersFormPageProps) {
  const organizations = Map.groupBy(people, (person) => person.orgName);
  return (
    <FormPage
      title={`Account managers for ${client.name}`}
      description="The people who look after the client."
      cancel={`/clients/${client.id}`}
      submit="Save"
      form={form}
      layer="drawer"
    >
      <div class="w-full">
        {form.fieldErrors.userId && (
          <FormError id="userId-error" errors={form.fieldErrors.userId} />
        )}
        <DataGrid columns={[{ kind: "fit" }, { label: "Person" }]}>
          {[...organizations].map(([orgName, orgPeople]) => (
            <>
              <DataGrid.Group>{orgName}</DataGrid.Group>
              {orgPeople.map((person) => (
                <DataGrid.Row for={`person-${person.id}`}>
                  <Checkbox
                    id={`person-${person.id}`}
                    name="userId"
                    value={String(person.id)}
                    checked={person.chosen}
                  />
                  <DataGrid.Title>{person.name}</DataGrid.Title>
                </DataGrid.Row>
              ))}
            </>
          ))}
        </DataGrid>
      </div>
    </FormPage>
  );
}
