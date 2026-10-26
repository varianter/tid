import { Button, Select } from "@tid/ui";

export type AssignablePerson = { id: number; name: string; orgName: string };

export function AssignConsultantForm({
  projectId,
  assignablePeople,
}: {
  projectId: number;
  assignablePeople: AssignablePerson[];
}) {
  return (
    <form
      method="post"
      action={`/projects/${projectId}/assignments`}
      class="stack-h items-center gap-xs"
    >
      <Select
        name="userId"
        aria-label="Consultant to assign"
        required
        options={assignablePeople.map((person) => ({
          value: person.id,
          label: person.name,
          group: person.orgName,
        }))}
      >
        <option value="">Choose a consultant</option>
      </Select>
      <Button type="submit">Assign</Button>
    </form>
  );
}

export function ReassignConsultantForm({
  projectId,
  userId,
  name,
}: {
  projectId: number;
  userId: number;
  name: string;
}) {
  return (
    <form method="post" action={`/projects/${projectId}/assignments`}>
      <input type="hidden" name="userId" value={userId} />
      <Button
        type="submit"
        data-variant="plain"
        data-size="small"
        aria-label={`Reassign ${name} to the project`}
      >
        Reassign
      </Button>
    </form>
  );
}
