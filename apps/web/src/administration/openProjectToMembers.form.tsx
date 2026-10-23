import { Button, Select } from "@tid/ui";
import { openProjectsPath } from "./administrationUrl";

type ProjectOption = { id: number; name: string; client: string };

export function OpenProjectToMembersForm({
  organizationSlug,
  projects,
}: {
  organizationSlug: string;
  projects: ProjectOption[];
}) {
  return (
    <form
      method="post"
      action={openProjectsPath(organizationSlug)}
      class="stack-h items-center gap-xs"
    >
      <Select
        name="projectId"
        aria-label="Project to open"
        required
        options={projects.map((project) => ({
          value: project.id,
          label: `${project.client} – ${project.name}`,
        }))}
      >
        <option value="">Choose a project</option>
      </Select>
      <Button type="submit">Open to everyone</Button>
    </form>
  );
}
