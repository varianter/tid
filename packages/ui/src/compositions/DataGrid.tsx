import { type Child, createContext, type PropsWithChildren, useContext } from "hono/jsx";

/**
 * Text columns share the spare width; the others take their content's width. Numbers and
 * actions sit at the end of their cell.
 */
type ColumnKind = "text" | "number" | "fit" | "action";

export type DataGridColumn = { label?: string; kind?: ColumnKind };

const tracks: Record<ColumnKind, string> = {
  text: "minmax(16ch, 1fr)",
  number: "max-content",
  fit: "max-content",
  action: "max-content",
};

const alignments: Record<ColumnKind, string | undefined> = {
  text: undefined,
  number: "ta-right",
  fit: undefined,
  action: "justify-self-end",
};

const ColumnsContext = createContext<DataGridColumn[]>([]);

/**
 * `columns` describes the header, widths and alignment once. A falsy column is dropped, so
 * `showRate && { … }` hides it, and rows drop the falsy cell that goes with it. The grid sits
 * straight on the page; only one under `Tabs` sits in a box, which ties it to its tab.
 */
function DataGridTable({
  columns,
  children,
}: PropsWithChildren<{ columns: (DataGridColumn | false)[] }>) {
  const shown = columns.filter((column) => column !== false);
  const template = shown.map((column) => tracks[column.kind ?? "text"]).join(" ");
  return (
    <ColumnsContext.Provider value={shown}>
      <div
        class="d-grid gap-column-l lh-snug t-tabular"
        style={`grid-template-columns: ${template}; overflow: auto; overflow-wrap: anywhere;`}
      >
        <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
          {shown.map((column) => (
            <span class={alignments[column.kind ?? "text"]}>{column.label}</span>
          ))}
        </div>
        {children}
      </div>
    </ColumnsContext.Provider>
  );
}

/** Puts each child in its column's cell. Rows are subgrids, so a missing cell would shift the rest. */
function Cells({ children }: PropsWithChildren) {
  const columns = useContext(ColumnsContext);
  const cells = ([children] as unknown[])
    .flat(Infinity)
    .filter((cell) => cell !== false && cell != null);
  if (cells.length !== columns.length) {
    throw new Error(`DataGrid row has ${cells.length} cells for ${columns.length} columns`);
  }
  return (
    <>
      {cells.map((cell, index) => (
        <span class={alignments[columns[index]?.kind ?? "text"]}>{cell as Child}</span>
      ))}
    </>
  );
}

const rowClass = "grid-all-columns grid-subgrid items-center b-b bc-subtle bg-wash:hover p-xs fs-s";

/**
 * With `href` the whole row is a link; with `for` it's the label of that form control. A row with
 * actions of its own links from its title instead, since a link can't hold buttons.
 */
function DataGridRow({
  href,
  for: labelFor,
  children,
}: PropsWithChildren<{ href?: string; for?: string }>) {
  const cells = <Cells>{children}</Cells>;
  if (href) {
    return (
      <a href={href} class={rowClass}>
        {cells}
      </a>
    );
  }
  if (labelFor) {
    return (
      <label for={labelFor} class={rowClass}>
        {cells}
      </label>
    );
  }
  return <div class={rowClass}>{cells}</div>;
}

const groupClass =
  "grid-all-columns b-b bc-subtle surface-tinted p-xs py-2xs fs-xs ink-subtle fw-bold";

/**
 * A heading that spans every column, naming what the rows below it share. With `href` it links
 * there. An `icon` takes the first column, so the heading lines up with the second.
 */
function DataGridGroup({
  href,
  icon,
  children,
}: PropsWithChildren<{ href?: string; icon?: Child }>) {
  const className = icon ? `${groupClass} grid-subgrid items-center` : groupClass;
  const content = icon ? (
    <>
      {icon}
      <span style="grid-column: 2 / -1;">{children}</span>
    </>
  ) : (
    children
  );
  return href ? (
    <a href={href} class={className}>
      {content}
    </a>
  ) : (
    <div class={className}>{content}</div>
  );
}

function DataGridFooter({ children }: PropsWithChildren) {
  return (
    <div class="grid-all-columns grid-subgrid items-center p-xs fs-s fw-medium">
      <Cells>{children}</Cells>
    </div>
  );
}

/** What a row is about, with an optional detail such as a code or email under it. */
function DataGridTitle({ secondary, children }: PropsWithChildren<{ secondary?: Child }>) {
  return (
    <span class="stack-v nowrap gap-4xs">
      <span class="fw-medium">{children}</span>
      {secondary && <span class="fs-xs ink-subtle">{secondary}</span>}
    </span>
  );
}

export const DataGrid = Object.assign(DataGridTable, {
  Row: DataGridRow,
  Group: DataGridGroup,
  Footer: DataGridFooter,
  Title: DataGridTitle,
});
