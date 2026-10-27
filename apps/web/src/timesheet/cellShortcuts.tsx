import { formatTotalHours } from "@tid/elements/hours";
import type { PropsWithChildren } from "hono/jsx";

/** The keys the timesheet conductor's cells answer to, as a footer under the timesheet. */
export function CellShortcuts({ fullDayMinutes }: { fullDayMinutes: number }) {
  const shortcuts: [string[], string][] = [
    [["↑", "↓", "←", "→"], "Move to the next cell. ← and → move once the caret is at the edge."],
    [["T"], "Go to today on the same task"],
    [["F"], `Fill in what's left of the day (${formatTotalHours(fullDayMinutes)} in all)`],
    [["A"], "Add a task"],
    [["Shift", "↑"], "Add half an hour"],
    [["Shift", "↓"], "Remove half an hour"],
    [["Enter"], "Save. Leaving the cell saves too."],
  ];
  return (
    <footer class="stack-h wrap gap-m fs-s ink-subtle">
      {shortcuts.map(([keys, description]) => (
        <span class="stack-h nowrap items-center gap-2xs">
          <Keys keys={keys} />
          {description}
        </span>
      ))}
    </footer>
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
