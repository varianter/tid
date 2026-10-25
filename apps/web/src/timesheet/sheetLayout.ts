import { css } from "hono/css";

/** Wraps to the width the day and its cells give the column, so every day stays as wide. */
export const dayLabelLayout = css`
  inline-size: 0;
  min-inline-size: 100%;
`;

/**
 * What stays put fades out at its edge, so cells slide under it rather than cut off. The stops ease
 * in and out, since a linear fade shows a visible edge where it starts and ends.
 */
const stickyFade = `linear-gradient(
  to right in oklch,
  var(--fade-color, var(--surface-base)),
  oklch(from var(--fade-color, var(--surface-base)) l c h / 0.9) 20%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / 0.65) 40%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / 0.35) 60%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / 0.05) 80%,
  oklch(from var(--fade-color, var(--surface-base)) l c h / 0)
)`;

/**
 * Phones log a day at a time, so there the sheet turns: each row becomes a column, with days
 * running down and tasks across. The markup and its look stay the desktop sheet's. Either way the
 * sheet scrolls only sideways, so the page alone scrolls down.
 */
export const sheetLayout = css`
  overflow-x: scroll;
  scroll-behavior: smooth;
  /* Focusing a cell scrolls it into view at the scrollport's edge, under the sticky task
     column. Padding the scrollport by that column keeps the first day's cells in sight. The
     task column takes its 1fr share only while everything fits, so when the sheet scrolls at
     all, the column is at its 20ch minimum. */
  scroll-padding-inline-start: 20ch;
  grid-template-columns: minmax(20ch, 1fr) repeat(var(--days), max-content);
  & [data-week-start] {
    margin-inline-start: var(--spacing-xs);
  }
  & [data-task] {
    background: ${stickyFade};
  }
  /* Only the sheet should scroll to today; a screen of margin keeps the page itself at the top. */
  & #today {
    scroll-margin-block-start: 100dvh;
    scroll-margin-inline: var(--spacing-xl);
  }

  @media (width < 40rem) {
    grid-auto-flow: column;
    grid-template-rows: auto repeat(var(--days), auto);
    grid-template-columns: max-content repeat(var(--task-columns), minmax(auto, 1fr));
    & > * {
      display: contents;
    }
    & [data-week-start] {
      margin-inline-start: 0;
      margin-block-start: var(--spacing-xs);
    }
    /* Padding rather than margin, so no gap shows what scrolls beneath. */
    & > * > :first-child {
      left: auto;
      margin-inline-end: 0;
      padding-inline-end: var(--spacing-xs);
    }
    /* The day totals don't fit beside the tasks; the project totals below still add up the month. */
    & > [data-totals] {
      display: none;
    }
    /* Days stay put while wide sheets scroll sideways. */
    /* The corner covers the task names, which cover the days, which cover cells. */
    & > :first-child > * {
      position: sticky;
      left: 0;
      z-index: 1;
      background: ${stickyFade};
    }
    & > :first-child > .surface-tinted {
      --fade-color: var(--surface-tinted);
    }
    & > * > :first-child {
      z-index: 2;
    }
    & > :first-child > :first-child {
      z-index: 3;
    }
    & #today {
      scroll-margin-block-start: 6lh;
    }
  }
`;
