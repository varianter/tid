export type InvoiceDataEntry = {
  projectCode: string;
  projectName: string;
  spentOn: string;
  user: string;
  task: string;
  minutes: number;
  amount: number;
};

const header = ["ProjectCode", "ProjectName", "SpentDate", "User", "Task", "Hours", "Amount"];

// Its own format rather than the app's display one, so a change to how the app shows hours can't
// change the file.
const hoursFormat = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 2,
  useGrouping: false,
});

// Copies the legacy system's export exactly, so whatever read that file reads this one: a BOM,
// semicolons, Norwegian decimals, dd.mm.yyyy dates, whole amounts without a currency, and no final
// newline. `invoiceDataCsv.golden.csv` is such an export, anonymized.
export function toInvoiceDataCsv(entries: InvoiceDataEntry[]) {
  const rows = entries.map((entry) => [
    entry.projectCode,
    entry.projectName,
    entry.spentOn.split("-").reverse().join("."),
    entry.user,
    entry.task,
    hoursFormat.format(entry.minutes / 60),
    String(Math.round(entry.amount)),
  ]);
  return `﻿${[header, ...rows].map((row) => row.map(csvField).join(";")).join("\n")}`;
}

/**
 * Quoted only when it must be, since the legacy file never quotes. Composed, like the legacy file,
 * so an "å" typed as "a" and a ring still reads as one letter.
 */
function csvField(value: string) {
  const composed = value.normalize("NFC");
  return /[;"\n\r]/.test(composed) ? `"${composed.replaceAll('"', '""')}"` : composed;
}
