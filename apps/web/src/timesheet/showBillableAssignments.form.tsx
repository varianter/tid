import { Button, Checkbox, Label } from "@tid/ui";
import { billableAssignmentsActionOf } from "./timesheet.url";

/** Submits on change and returns to the same month, so it reads like the filters beside it. */
export function ShowBillableAssignmentsForm({
  month,
  search,
  shown,
}: {
  month: string;
  search: string;
  shown: boolean;
}) {
  return (
    <auto-submit>
      <form
        method="post"
        action={billableAssignmentsActionOf(month, search)}
        class="stack-v flex-nowrap gap-3xs"
      >
        <Label for="billable-assignments" class="stack-h items-center gap-2xs">
          <Checkbox id="billable-assignments" name="show" value="on" checked={shown} />
          Show billable assignments
        </Label>
        <noscript>
          <Button type="submit" data-size="small">
            Save
          </Button>
        </noscript>
      </form>
    </auto-submit>
  );
}
