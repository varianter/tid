-- Billable projects take their contract owner's currency, or any participating organization's.
-- Non-billable projects bill nothing, so they have none.
ALTER TABLE "projects" ADD COLUMN "currency" char(3);
--> statement-breakpoint
UPDATE "projects" SET "currency" = coalesce((
  select organizations.currency
  from project_organizations
  join organizations on organizations.id = project_organizations.org_id
  where project_organizations.project_id = projects.id
  order by project_organizations.is_contract_owner desc, organizations.id
  limit 1
), 'NOK')
WHERE "billing" <> 'non_billable';
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "billable_projects_have_currency" CHECK (("projects"."billing" = 'non_billable') = ("projects"."currency" is null));
--> statement-breakpoint

-- The rate a new entry on this task and day gets: the latest assignment rate that has started, in
-- the project's currency. No row when the assignment has no rate, or the project isn't billed by
-- the hour.
create or replace function entry_rate(entry_user_id bigint, entry_task_id bigint, entry_spent_on date)
returns table (rate integer, currency char(3))
language sql stable
as $$
  select assignment_rates.rate, projects.currency
  from tasks
  join projects on projects.id = tasks.project_id and projects.billing = 'hourly'
  join assignment_rates
    on assignment_rates.project_id = tasks.project_id
    and assignment_rates.user_id = entry_user_id
    and assignment_rates.valid_from <= entry_spent_on
  where tasks.id = entry_task_id
  order by assignment_rates.valid_from desc
  limit 1
$$;
--> statement-breakpoint

-- Changing billing or currency would leave logged time with rates that no longer fit it, so a
-- project that bills differently is a new project. Clearing a cell deletes its entry, so any entry
-- is real time.
create or replace function project_billing_fixed_once_logged() returns trigger
language plpgsql
as $$
begin
  if exists (
    select from time_entries
    join tasks on tasks.id = time_entries.task_id
    where tasks.project_id = new.id
  ) then
    raise exception 'A project''s billing and currency can''t change once time is logged on it'
      using errcode = 'check_violation', constraint = 'project_billing_fixed_once_logged';
  end if;
  return new;
end;
$$;
--> statement-breakpoint

drop trigger project_billing_fixed_once_logged on projects;
--> statement-breakpoint

create trigger project_billing_fixed_once_logged
before update of billing, currency on projects
for each row
when (new.billing is distinct from old.billing or new.currency is distinct from old.currency)
execute function project_billing_fixed_once_logged();
