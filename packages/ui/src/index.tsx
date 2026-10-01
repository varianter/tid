import type { Child, JSX, PropsWithChildren } from "hono/jsx";

type Tag = keyof JSX.IntrinsicElements;

// Hono accepts any attribute on every element. Dropping that index signature
// makes typos and attributes from the wrong element (`href` on a button) errors.
type AttributesOf<T extends Tag> = {
  [K in keyof JSX.IntrinsicElements[T] as string extends K
    ? never
    : K]: JSX.IntrinsicElements[T][K];
};

// `class` is narrowed to string because Hono also allows a Promise there.
type Props<T extends Tag, Data = object> = Omit<AttributesOf<T>, "class" | keyof Data> &
  Data & { class?: string };

type Size = "small" | "medium" | "large";
type Sized = { "data-size"?: Size };

function classes(base: string, extra: string | undefined) {
  return extra ? `${base} ${extra}` : base;
}

type ButtonData = Sized & { "data-variant"?: "filled" | "tinted" | "outlined" | "plain" };

// Without `as`, TypeScript can't tell the branches apart and would accept a
// link's attributes on a button. `never` closes that gap for link-only ones.
type LinkOnly = { [K in Exclude<keyof AttributesOf<"a">, keyof AttributesOf<"button">>]?: never };

export type ButtonProps =
  | PropsWithChildren<Props<"button", ButtonData> & LinkOnly & { as?: "button" }>
  | PropsWithChildren<Props<"a", ButtonData> & { as: "a" }>;

export function Button(props: ButtonProps) {
  if (props.as === "a") {
    const { as, class: className, ...attributes } = props;
    return <a class={classes("v-button", className)} {...attributes} />;
  }
  const { as, class: className, ...attributes } = props;
  return <button class={classes("v-button", className)} {...attributes} />;
}

export function Input({ class: className, ...attributes }: Props<"input", Sized>) {
  return <input class={classes("v-input", className)} {...attributes} />;
}

export function Textarea({
  class: className,
  ...attributes
}: PropsWithChildren<Props<"textarea", Sized>>) {
  return <textarea class={classes("v-textarea", className)} {...attributes} />;
}

export function Select({
  class: className,
  ...attributes
}: PropsWithChildren<Props<"select", Sized>>) {
  return <select class={classes("v-select", className)} {...attributes} />;
}

export function Checkbox({ class: className, ...attributes }: Omit<Props<"input", Sized>, "type">) {
  return <input type="checkbox" class={classes("v-checkbox", className)} {...attributes} />;
}

export function Radio({ class: className, ...attributes }: Omit<Props<"input", Sized>, "type">) {
  return <input type="radio" class={classes("v-radio", className)} {...attributes} />;
}

export function Range({ class: className, ...attributes }: Omit<Props<"input", Sized>, "type">) {
  return <input type="range" class={classes("v-range", className)} {...attributes} />;
}

export function Label({ class: className, ...attributes }: PropsWithChildren<Props<"label">>) {
  // biome-ignore lint/a11y/noLabelWithoutControl: the caller passes `for` or nests the control.
  return <label class={classes("v-form-label", className)} {...attributes} />;
}

type TableData = { "data-density"?: "compact" | "default" | "relaxed" };

export function Table({
  class: className,
  ...attributes
}: PropsWithChildren<Props<"table", TableData>>) {
  return <table class={classes("v-table", className)} {...attributes} />;
}

type PopoverData = {
  "data-type"?: "dialog" | "drawer" | "tooltip";
  "data-position"?: "top" | "right" | "bottom" | "left";
  "data-backdrop"?: boolean;
};

export function Popover({
  class: className,
  popover = "auto",
  ...attributes
}: PropsWithChildren<Props<"div", PopoverData>>) {
  return <div class={classes("v-popover", className)} popover={popover} {...attributes} />;
}

type PageProps = PropsWithChildren<{
  title: string;
  back?: { href: string; label: string };
  actions?: Child;
}>;

export function Page({ title, back, actions, children }: PageProps) {
  const heading = <h1 class="fs-m">{title}</h1>;
  return (
    <main class="p-xl stack-v nowrap gap-xl">
      <header class="stack-v gap-2xs">
        {/* The actions share the top row, which is the back link when there is one. */}
        <div class="stack-h items-center gap-m">
          {back ? (
            <Button as="a" href={back.href} data-variant="plain" data-size="small">
              <div class="v-icon" data-v-icon="chevron-left" />
              {back.label}
            </Button>
          ) : (
            heading
          )}
          {actions && <div class="stack-h items-center gap-m ml-auto">{actions}</div>}
        </div>
        {back && heading}
      </header>
      {children}
    </main>
  );
}

export function PeriodNavigation({
  previousHref,
  nextHref,
  previousLabel,
  nextLabel,
  children,
}: PropsWithChildren<{
  previousHref: string;
  nextHref: string;
  previousLabel: string;
  nextLabel: string;
}>) {
  return (
    <nav
      class="stack-h nowrap b-all bc-default br-l p-4xs justify-between"
      style="width: min(30ch, max-content);"
    >
      <Button
        as="a"
        href={previousHref}
        class="aspect-square p-0"
        data-variant="plain"
        data-size="small"
        aria-label={previousLabel}
      >
        <div class="v-icon" data-v-icon="chevron-left" />
      </Button>
      <span class="stack-h nowrap gap-2xs px-xs fw-medium">
        <CalendarIcon />
        <span class="fw-regular">{children}</span>
      </span>
      <Button
        as="a"
        href={nextHref}
        class="aspect-square p-0"
        data-variant="plain"
        data-size="small"
        aria-label={nextLabel}
      >
        <div class="v-icon" data-v-icon="chevron-right" />
      </Button>
    </nav>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

type EmptyStateProps = PropsWithChildren<{ emoji: string; title: string; action?: Child }>;

export function EmptyState({ emoji, title, action, children }: EmptyStateProps) {
  return (
    <div class="surface-tinted b-all bc-subtle br-xl p-xl stack-v items-center w-max-7 mx-auto">
      <span class="fs-2xl" aria-hidden="true">
        {emoji}
      </span>
      <h2 class="fs-l fw-bold mt-m">{title}</h2>
      {children && <p class="fs-s ink-subtle ta-center mt-2xs">{children}</p>}
      {action && <div class="mt-m">{action}</div>}
    </div>
  );
}
