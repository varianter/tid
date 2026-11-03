import { expect, test } from "bun:test";
import { toInvoiceDataCsv } from "./invoiceDataCsv";

const entry = {
  projectCode: "OL1000",
  projectName: "Bryggeri (Ærlig Øl AS)",
  user: "Åse Ødegård",
  task: "Seniorutvikler",
};

test("the CSV matches the legacy export byte for byte", async () => {
  const golden = await Bun.file(`${import.meta.dir}/invoiceDataCsv.golden.csv`).bytes();
  const csv = toInvoiceDataCsv([
    { ...entry, spentOn: "2026-10-30", minutes: 450, amount: 10875 },
    { ...entry, spentOn: "2026-10-28", minutes: 390, amount: 9425 },
    // Decomposed, as some keyboards type it.
    {
      ...entry,
      user: entry.user.normalize("NFD"),
      spentOn: "2026-10-26",
      minutes: 360,
      amount: 8700,
    },
  ]);
  expect(new TextEncoder().encode(csv)).toEqual(golden);
});
