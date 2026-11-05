import { Tabs } from "@tid/ui";
import { consultantHoursUrl, invoiceDataUrl, monthCloseOverviewUrl } from "./monthClose.url";

/**
 * Switches between the steps of closing a month, keeping the month. `organization` is whose
 * consultants the Consultants tab shows.
 */
export function MonthCloseTabs({
  active,
  month,
  organization,
  fixedPrice,
}: {
  active: "overview" | "consultants" | "invoiceData";
  month: string;
  organization: string;
  fixedPrice?: boolean;
}) {
  return (
    <Tabs aria-label="Month close" class="self-start">
      <Tabs.Link
        href={monthCloseOverviewUrl.path({ month, fixedPrice })}
        active={active === "overview"}
      >
        Overview
      </Tabs.Link>
      <Tabs.Link
        href={consultantHoursUrl.path({ month, organization })}
        active={active === "consultants"}
      >
        Consultants
      </Tabs.Link>
      <Tabs.Link
        href={invoiceDataUrl.path({ month, fixedPrice })}
        active={active === "invoiceData"}
      >
        Invoice data
      </Tabs.Link>
    </Tabs>
  );
}
