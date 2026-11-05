import { formatDate } from "@tid/calendar/dateDisplay";
import { formatHours, formatTotalHours } from "@tid/elements/hours";
import { formatAmount } from "../domain/amount/amount";
import type { ProjectReport } from "../projects/projectReport";

/** What `invoiceData.typ` lays out. Every value is formatted here, so the PDF reads like the app. */
export type InvoiceData = {
  title: string;
  client: string;
  project: string;
  period: string;
  amount?: string;
  days: { label: string; dayOff: boolean }[];
  consultants: { name: string; days: string[]; total: string }[];
  totals: { days: string[]; total: string };
};

export const invoiceDataTemplate = `${import.meta.dir}/invoiceData.typ`;

export function toInvoiceData({
  project,
  period,
  days,
  calendar,
  consultants,
  hours,
  amount,
}: ProjectReport): InvoiceData {
  // A dash shows the day was looked at, where a blank could look like a missing value.
  const dayHours = (dayHours: number) => formatHours(Math.round(dayHours * 60)) || "-";
  const hoursOn = (day: string) =>
    consultants.reduce((total, consultant) => total + (consultant.hoursByDay.get(day) ?? 0), 0);
  return {
    title: `Invoice data – ${project.client} – ${period}`,
    client: project.client,
    project: project.name,
    period,
    amount:
      amount !== undefined && project.currency
        ? formatAmount(amount, project.currency, "exact")
        : undefined,
    days: days.map((day) => ({
      label: String(Number(day.slice(8))),
      dayOff: !calendar.isWorkday(day),
    })),
    consultants: consultants.map((consultant) => ({
      name: consultant.name,
      days: days.map((day) => dayHours(consultant.hoursByDay.get(day) ?? 0)),
      total: formatTotalHours(consultant.hours * 60),
    })),
    totals: {
      days: days.map((day) => dayHours(hoursOn(day))),
      total: formatTotalHours(hours * 60),
    },
  };
}

/** Names a project's PDF or CSV after its code, like the legacy export: `AKS1000.pdf`. */
export const invoiceDataFileName = (projectCode: string, extension: "pdf" | "csv") =>
  // Characters some file systems refuse.
  `${projectCode.replace(/[/\\:*?"<>|\p{Cc}]/gu, "-")}.${extension}`;

/** Like "10 October - invoice data.zip". The number sorts a year's zips in a folder. */
export const invoiceDataZipFileName = (month: string) =>
  `${month.slice(5)} ${formatDate(month, "monthName")} - invoice data.zip`;
