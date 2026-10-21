import { billing } from "@tid/db/schema";

export type Billing = (typeof billing.enumValues)[number];

export const billings = billing.enumValues;

export const billingLabels: Record<Billing, string> = {
  hourly: "Hourly",
  fixed_fee: "Fixed price",
  non_billable: "Non-billable",
};

export const billingDescriptions: Record<Billing, string> = {
  hourly: "The client pays for each hour, at each consultant's rate.",
  fixed_fee: "The client pays an agreed price, however many hours it takes.",
  non_billable: "No one is invoiced, like internal work or absence.",
};
