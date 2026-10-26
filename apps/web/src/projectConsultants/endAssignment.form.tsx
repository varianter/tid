import { Button, Icon, Input, Label, Popover } from "@tid/ui";
import type { AssignmentIds } from "./assignment";

export function EndAssignmentForm({
  ids,
  name,
  today,
}: {
  ids: AssignmentIds;
  name: string;
  today: string;
}) {
  const popoverId = `end-assignment-${ids.userId}`;
  const dateId = `${popoverId}-date`;
  return (
    <>
      <Button
        type="button"
        popovertarget={popoverId}
        class="aspect-square p-0"
        data-variant="plain"
        data-size="small"
        aria-label={`End ${name}'s assignment`}
      >
        <Icon name="close" />
      </Button>
      <Popover id={popoverId} data-type="tooltip" data-position="left" class="px-2xs py-2xs">
        <form
          method="post"
          action={`/projects/${ids.projectId}/assignments/${ids.userId}/end`}
          class="stack-v gap-s b-all bc-subtle p-m surface-base br-m shadow-mid"
        >
          <div class="stack-v gap-3xs">
            <Label for={dateId}>Last day on the project</Label>
            <Input type="date" id={dateId} name="endsOn" value={today} required />
          </div>
          <Button type="submit">End assignment</Button>
        </form>
      </Popover>
    </>
  );
}
