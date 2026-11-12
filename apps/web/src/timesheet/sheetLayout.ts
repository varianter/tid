import { css, keyframes } from "hono/css";

/** Wraps to the width the day and its cells give the column, so every day stays as wide. */
export const dayLabelLayout = css`
  inline-size: 0;
  min-inline-size: 100%;
`;

/**
 * What stays put fades out at its edge, so cells slide under it rather than cut off. The curved
 * stops stay readable through the middle, then fall away quickly without a hard transparent edge.
 */
const stickyFade = `linear-gradient(
  to right in oklch,
  var(--fade-color, var(--surface-base)),
  oklch(from var(--fade-color, var(--surface-base)) l c h / calc(pow(1 - pow(0.4, 4), 3))) 40%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / calc(pow(1 - pow(0.6, 4), 3))) 60%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / calc(pow(1 - pow(0.75, 4), 3))) 75%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / calc(pow(1 - pow(0.85, 4), 3))) 85%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / calc(pow(1 - pow(0.92, 4), 3))) 92%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / calc(pow(1 - pow(0.97, 4), 3))) 97%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / 0)
)`;

/** Slides the task names by as much as the sheet has scrolled: from none to their overflow. */
const followSheet = keyframes`
  to {
    translate: calc(100cqi - 100%);
  }
`;

/**
 * Holds the sheet and, on phones, the task names above it. The sheet scrolls sideways, so names
 * inside it could only stick within the sheet, which never scrolls down. Above it, they stick to
 * the page, and the sheet's scroll timeline slides them along with its columns.
 */
export const sheetFrame = css`
  timeline-scope: --sheet;
  /* The names cover the weeks and days, which cover cells. */
  --layer-header: 1;
  --layer-task-names: 2;
  /* Fixed on phones, so the names above the sheet line up with its columns. */
  --week-column: var(--spacing-l);
  --day-column: calc(6ch + 2 * var(--spacing-3xs));
  --task-column: calc(20ch + 2 * var(--spacing-3xs));

  & > [data-task-names] {
    display: none;
  }

  @media (width < 40rem) {
    & > [data-task-names] {
      display: block;
      position: sticky;
      top: 0;
      z-index: var(--layer-task-names);
      overflow: clip;
      container-type: inline-size;
      background: var(--surface-base);
    }
    /* As wide as the sheet's columns, so it slides exactly as far as the sheet scrolls. */
    & [data-task-name-track] {
      display: grid;
      grid-template-columns: repeat(var(--task-columns), var(--task-column));
      inline-size: max-content;
      padding-inline: calc(var(--week-column) + var(--day-column)) var(--spacing-m);
      overflow-wrap: anywhere;
      animation: ${followSheet} linear both;
      animation-timeline: --sheet;
    }
  }
`;

/**
 * Phones log a day at a time, so there the sheet turns: each row becomes a column, with days
 * running down and tasks across. The markup and its look stay the desktop sheet's. Either way the
 * sheet scrolls only sideways, so the page alone scrolls down.
 */
export const sheetLayout = css`
  overflow-x: scroll;
  scroll-timeline: --sheet x;
  @media (prefers-reduced-motion: no-preference) {
    scroll-behavior: smooth;
  }
  /* Focusing a cell scrolls it into view at the scrollport's edge, under the sticky task
     column. Padding the scrollport by that column keeps the first day's cells in sight. The
     task column takes its 1fr share only while everything fits, so when the sheet scrolls at
     all, the column is at its minimum. */
  scroll-padding-inline-start: 24ch;
  grid-template-columns: minmax(24ch, 1fr) repeat(var(--day-tracks), max-content);
  & [data-week-gap] {
    inline-size: var(--spacing-xs);
  }
  & [data-week] {
    grid-column: span var(--week-days);
  }
  /* The one fixed width in the sheet: day columns take theirs from it in every layout. */
  & [data-cell] {
    inline-size: 10ch;
  }
  & [data-task] {
    position: sticky;
    --fade-color: var(--surface-base);
    background: ${stickyFade};
  }
  /* Only the sheet should scroll to today; a screen of margin keeps the page itself at the top. */
  & #today {
    scroll-margin-block-start: 100dvh;
    scroll-margin-inline: var(--spacing-xl);
  }

  /* Task names stay put while the days scroll beneath them. */
  @media (width >= 40rem) {
    & [data-task] {
      left: 0;
      margin-inline-end: var(--spacing-xs);
      padding-inline-end: var(--spacing-2xs);
    }
  }

  @media (width < 40rem) {
    grid-auto-flow: column;
    grid-template-rows: repeat(var(--day-tracks), auto);
    /* The weeks become a narrow column of bars left of the days, each as tall as its days. */
    grid-template-columns: var(--week-column) var(--day-column) repeat(
        var(--task-columns),
        var(--task-column)
      );
    & [data-week-gap] {
      inline-size: auto;
      block-size: var(--spacing-xs);
    }
    & [data-week] {
      grid-column: auto;
      grid-row: span var(--week-days);
      margin-block-end: 0;
      margin-inline-end: var(--spacing-3xs);
      padding-inline: var(--spacing-3xs);
      writing-mode: vertical-rl;
      rotate: 180deg;
      text-align: end;
    }
    & > [data-row] {
      display: contents;
    }
    & [data-cell] {
      inline-size: 20ch;
    }
    /* The task names sit above the sheet instead, with nothing left for the corners to label. */
    & [data-task] {
      display: none;
    }
    /* Focus would scroll a cell's input up under the task names stuck above. */
    & [data-cell] input {
      scroll-margin-block-start: 3lh;
    }
    /* The day totals don't fit beside the tasks; the project totals below still add up the month. */
    & > [data-totals] {
      display: none;
    }
    /* Weeks and days stay put while wide sheets scroll sideways. */
    & > [data-weeks] > *,
    & > [data-days] > * {
      /* position: sticky;
      left: 0; */
      z-index: var(--layer-header);
    }
    & > [data-days] > * {
    position: sticky;
      left: var(--week-column);
      left: 0;
      background: ${stickyFade};
    }
    /* Solid rather than faded, so the gaps between weeks hide what's beneath. */
    & > :is([data-weeks], [data-days]) > [data-week-gap] {
      background: var(--surface-base);
    }
    & > [data-days] > .surface-tinted {
      --fade-color: var(--surface-tinted);
    }
    & #today {
      scroll-margin-block-start: 6lh;
    }
  }
`;
