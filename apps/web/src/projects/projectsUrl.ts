export const projectTimesheetPath = (projectId: number, month: string, company: string) =>
  `/projects/${projectId}/timesheet/${month}?${new URLSearchParams({ company })}`;
