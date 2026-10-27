import { thisMonthInOslo } from "@tid/calendar/osloClock";
import { z } from "zod";
import { monthField } from "../framework/pageMonth";
import { idParam, pageUrl } from "../framework/pageUrl";

export const consultantsPath = (organization: string) =>
  `/consultants?${new URLSearchParams({ organization })}`;

export const consultantUrl = pageUrl(
  "/consultants/:userId",
  z.object({ userId: idParam, ...monthField }),
);

export const consultantPath = (userId: number, month = thisMonthInOslo()) =>
  consultantUrl.path({ userId, month });
