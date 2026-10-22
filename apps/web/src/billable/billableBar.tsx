import { ProgressBar } from "@tid/ui";

const billableColor = "var(--palette-blue-500)";
const nonBillableColor = "var(--palette-blue-250)";

/** Billable then non-billable time, filling up to capacity. Any unit works, as long as all three share it. */
export function BillableBar({
  billable,
  nonBillable,
  capacity,
  class: className,
}: {
  billable: number;
  nonBillable: number;
  capacity: number;
  class?: string;
}) {
  return (
    <ProgressBar
      class={className}
      max={capacity}
      segments={[
        { value: billable, color: billableColor },
        { value: nonBillable, color: nonBillableColor },
      ]}
    />
  );
}
