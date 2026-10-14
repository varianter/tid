// What the import reads from one Harvest account, typed as far as it's used.
export type HarvestExport = {
  account: { id: number; name: string };
  users: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    is_active: boolean;
    access_roles: string[];
    default_hourly_rate: number | null;
  }[];
  projects: {
    id: number;
    code: string | null;
    name: string;
    is_active: boolean;
    is_billable: boolean;
    is_fixed_fee: boolean;
    // Where the rate comes from: the project, each task or each person.
    bill_by: "Project" | "Tasks" | "People" | "none";
    hourly_rate: number | null;
    starts_on: string | null;
    ends_on: string | null;
    client: { name: string; currency: string };
  }[];
  // Only active assignments, which say who may log time where today.
  userAssignments: {
    project: { id: number };
    user: { id: number };
    use_default_rates: boolean;
    hourly_rate: number | null;
    created_at: string;
  }[];
  taskAssignments: {
    project: { id: number };
    task: { name: string };
    billable: boolean;
    hourly_rate: number | null;
  }[];
  // Empty when only today's state is imported.
  timeEntries: {
    spent_date: string;
    hours: number;
    notes: string | null;
    billable: boolean;
    billable_rate: number | null;
    user: { id: number };
    client: { currency: string };
    project: { id: number };
    task: { name: string };
  }[];
};
