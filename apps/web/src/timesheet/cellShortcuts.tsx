import type { PropsWithChildren } from "hono/jsx";

/** The keys the timesheet conductor's cells answer to, as a footer under the timesheet. */
export function CellShortcuts() {
  const shortcuts: [string[], string][] = [
    [["↑", "↓", "←", "→"], "Move between cells"],
    [["T"], "Go to today"],
    [["F"], `Fill in the remaining time for today`],
    [["A"], "Add a task"],
    [["Shift", "↑"], "Add half an hour"],
    [["Shift", "↓"], "Remove half an hour"],
  ];
  return (
    <footer class="stack-h wrap gap-m gap-row-xs fs-s ink-subtle justify-center mt-xl">
      {shortcuts.map(([keys, description]) => (
        <span class="stack-h flex-nowrap items-center gap-2xs">
          <Keys keys={keys} />
          {description}
        </span>
      ))}
    </footer>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span class="stack-h flex-nowrap gap-3xs">
      {keys.map((key) => (
        <Key>{key}</Key>
      ))}
    </span>
  );
}

function Key({ children }: PropsWithChildren) {
  return (
    <kbd class="b-all bc-subtle surface-tinted ink-prominent br-s px-3xs fs-xs">{children}</kbd>
  );
}
