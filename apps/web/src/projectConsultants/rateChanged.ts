import { formatDate } from "@tid/calendar/dateDisplay";
import type { Flash } from "../framework/flash";

/** Shown once a rate is added, whether or not logged hours were repriced along the way. */
export function rateAddedFlash(consultantName: string, validFrom: Temporal.PlainDate): Flash {
  return {
    title: "Rate added",
    message: `Added a rate for ${consultantName} from ${formatDate(validFrom)}.`,
  };
}

export function rateDeletedFlash(consultantName: string, validFrom: Temporal.PlainDate): Flash {
  return {
    title: "Rate deleted",
    message: `Deleted the rate for ${consultantName} from ${formatDate(validFrom)}.`,
  };
}
