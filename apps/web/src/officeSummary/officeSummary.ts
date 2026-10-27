import type { Country } from "@tid/calendar/publicHolidays";
import { type Amounts, addAmounts } from "../domain/amount/amount";
import { capacityMinutes } from "../domain/capacity/capacity";

type Office = { legalName: string; country: Country; fullDayMinutes: number };

/** One consultant's time in one month and currency. */
export type LoggedTime = {
  office: string;
  userId: number;
  endsOn: string | null;
  month: string;
  currency: string | null;
  hours: number;
  billableHours: number;
  billableBaseHours: number;
  amount: number;
  /** Billable hours that have an amount; fixed fee and unrated time don't. */
  ratedHours: number;
};

export type OfficeTotals = {
  consultants: number;
  hours: number;
  billableHours: number;
  billableBaseHours: number;
  capacityHours: number;
  amounts: Amounts;
  ratedHours: Amounts;
};

const empty = (): OfficeTotals => ({
  consultants: 0,
  hours: 0,
  billableHours: 0,
  billableBaseHours: 0,
  capacityHours: 0,
  amounts: {},
  ratedHours: {},
});

/**
 * Totals per office, keyed by legal name. Consultants are those who logged time, and capacity is
 * theirs in the months they logged it, since users have no start date to tell who was employed.
 */
export function summarizeOffices(offices: Office[], logged: LoggedTime[]) {
  const totals = new Map(offices.map((office) => [office.legalName, empty()]));
  const officeByName = new Map(offices.map((office) => [office.legalName, office]));
  const consultants = new Map<string, Set<number>>();
  const consultantMonths = new Set<string>();
  for (const time of logged) {
    const office = officeByName.get(time.office);
    const sum = totals.get(time.office);
    if (!office || !sum) continue;
    sum.hours += time.hours;
    sum.billableHours += time.billableHours;
    sum.billableBaseHours += time.billableBaseHours;
    if (time.currency) {
      sum.amounts = addAmounts(sum.amounts, { [time.currency]: time.amount });
      sum.ratedHours = addAmounts(sum.ratedHours, { [time.currency]: time.ratedHours });
    }
    const people = consultants.get(time.office) ?? new Set();
    people.add(time.userId);
    consultants.set(time.office, people);
    // Rows come per currency too, so count each consultant's month once.
    const consultantMonth = `${time.userId} ${time.month}`;
    if (!consultantMonths.has(consultantMonth)) {
      consultantMonths.add(consultantMonth);
      sum.capacityHours +=
        capacityMinutes(time.month, office.country, office.fullDayMinutes, time.endsOn) / 60;
    }
  }
  for (const [name, people] of consultants) {
    const sum = totals.get(name);
    if (sum) sum.consultants = people.size;
  }
  return totals;
}

/** Billable hours as a percentage of the billable base, per month, across every office. */
export function billablePercentByMonth(logged: LoggedTime[]) {
  const byMonth = Map.groupBy(logged, (time) => time.month);
  return new Map(
    [...byMonth].map(([month, times]) => {
      const billable = times.reduce((sum, time) => sum + time.billableHours, 0);
      const base = times.reduce((sum, time) => sum + time.billableBaseHours, 0);
      return [month, base === 0 ? 0 : (billable / base) * 100];
    }),
  );
}

/** Every office added up, leaving out money, which can't be added across currencies. */
export function totalOfOffices(totals: OfficeTotals[]) {
  return totals.reduce(
    (total, office) => ({
      consultants: total.consultants + office.consultants,
      hours: total.hours + office.hours,
      billableHours: total.billableHours + office.billableHours,
      billableBaseHours: total.billableBaseHours + office.billableBaseHours,
      capacityHours: total.capacityHours + office.capacityHours,
    }),
    { consultants: 0, hours: 0, billableHours: 0, billableBaseHours: 0, capacityHours: 0 },
  );
}

/** Amount per rated hour, per currency. */
export function averageRates({ amounts, ratedHours }: OfficeTotals): Amounts {
  return Object.fromEntries(
    Object.entries(amounts)
      .filter(([currency]) => (ratedHours[currency] ?? 0) > 0)
      .map(([currency, amount]) => [currency, amount / (ratedHours[currency] ?? 1)]),
  );
}

export function amountPerConsultant({ amounts, consultants }: OfficeTotals): Amounts {
  if (consultants === 0) return {};
  return Object.fromEntries(
    Object.entries(amounts).map(([currency, amount]) => [currency, amount / consultants]),
  );
}
