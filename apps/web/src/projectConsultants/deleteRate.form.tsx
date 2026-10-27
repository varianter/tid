import { formatDate } from "@tid/calendar/dateDisplay";
import { Button } from "@tid/ui";
import type { ProjectConsultantIds } from "./projectConsultant";
import { ratesPath } from "./projectConsultants.url";

export function DeleteRateForm({
  ids,
  validFrom,
}: {
  ids: ProjectConsultantIds;
  validFrom: string;
}) {
  return (
    <form method="post" action={`${ratesPath(ids)}/${validFrom}/delete`}>
      <Button
        type="submit"
        data-variant="plain"
        data-size="small"
        aria-label={`Delete the rate starting ${formatDate(validFrom, "numeric")}`}
      >
        Delete
      </Button>
    </form>
  );
}
