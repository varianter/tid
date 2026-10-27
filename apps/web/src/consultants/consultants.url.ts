import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { z } from "zod";
import { monthField } from "../query/pageMonth";
import { idParam, pageUrl } from "../query/pageUrl";

export const consultantsPath = (organization: string) =>
  `/consultants?${new URLSearchParams({ organization })}`;

export const consultantUrl = pageUrl(
  "/consultants/:userId",
  z.object({ userId: idParam, ...monthField }),
);

export const consultantPath = (userId: number, month = thisMonthInOslo()) =>
  consultantUrl.path({ userId, month });
