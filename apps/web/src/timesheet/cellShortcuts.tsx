import { formatTotalHours } from "@tid/elements/hours";
import { Button, DataGrid, Popover } from "@tid/ui";
import type { PropsWithChildren } from "hono/jsx";

const popoverId = "cell-shortcuts";

/** The keys the timesheet conductor's cells answer to, behind a button. */
export function CellShortcuts({ fullDayMinutes }: { fullDayMinutes: number }) {
  return (
    <>
      <Button type="button" popovertarget={popoverId} data-variant="plain" data-size="small">
        Shortcuts
      </Button>
      <Popover id={popoverId} data-type="dialog" data-backdrop>
        <div class="stack-v gap-s b-all bc-subtle p-m surface-base br-m shadow-mid">
          <h2 class="fs-m fw-bold">Keyboard shortcuts</h2>
          <DataGrid columns={[{ label: "Keys", kind: "fit" }, { label: "In a cell" }]}>
            <DataGrid.Row>
              <Keys keys={["↑", "↓", "←", "→"]} />
              <span>Move to the next cell. ← and → move once the caret is at the edge.</span>
            </DataGrid.Row>
            <DataGrid.Row>
              <Keys keys={["Shift", "T"]} />
              <span>Go to today on the same task</span>
            </DataGrid.Row>
            <DataGrid.Row>
              <Keys keys={["F"]} />
              <span>Fill in a full day ({formatTotalHours(fullDayMinutes)})</span>
            </DataGrid.Row>
            <DataGrid.Row>
              <Keys keys={["Shift", "↑"]} />
              <span>Add half an hour</span>
            </DataGrid.Row>
            <DataGrid.Row>
              <Keys keys={["Shift", "↓"]} />
              <span>Remove half an hour</span>
            </DataGrid.Row>
            <DataGrid.Row>
              <Keys keys={["Enter"]} />
              <span>Save. Leaving the cell saves too.</span>
            </DataGrid.Row>
          </DataGrid>
        </div>
      </Popover>
    </>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span class="stack-h nowrap gap-3xs">
      {keys.map((key) => (
        <Key>{key}</Key>
      ))}
    </span>
  );
}

function Key({ children }: PropsWithChildren) {
  return <kbd class="b-all bc-subtle br-s px-3xs fs-xs">{children}</kbd>;
}
