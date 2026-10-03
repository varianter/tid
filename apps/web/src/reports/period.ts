import { daysOfMonth, isIsoDate } from "../dates/dates";

export const tabs = ["clients", "projects", "consultants", "tasks"] as const;
export type Tab = (typeof tabs)[number];

const isTab = (value: string | undefined): value is Tab => tabs.some((tab) => tab === value);

/**
 * The canonical query for a monthly report. Anything missing or invalid falls back to the month
 * of `from` or the current month, and to the first tab, so a sloppy URL redirects instead of failing.
 */
export function reportQuery(from: string | undefined, tab: string | undefined, today: string) {
  const month = (from && isIsoDate(from) ? from : today).slice(0, 7);
  const days = daysOfMonth(month);
  return new URLSearchParams({
    view: "month",
    from: days[0] ?? "",
    till: days.at(-1) ?? "",
    tab: isTab(tab) ? tab : tabs[0],
  });
}
