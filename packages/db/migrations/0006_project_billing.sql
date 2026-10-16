-- Changing billing would leave logged time with rates that no longer fit it, so a project that
-- bills differently is a new project. Clearing a cell deletes its entry, so any entry is real time.
create function project_billing_fixed_once_logged() returns trigger
language plpgsql
as $$
begin
  if exists (
    select from time_entries
    join tasks on tasks.id = time_entries.task_id
    where tasks.project_id = new.id
  ) then
    raise exception 'A project''s billing can''t change once time is logged on it'
      using errcode = 'check_violation', constraint = 'project_billing_fixed_once_logged';
  end if;
  return new;
end;
$$;
--> statement-breakpoint

create trigger project_billing_fixed_once_logged
before update of billing on projects
for each row
when (new.billing is distinct from old.billing)
execute function project_billing_fixed_once_logged();
