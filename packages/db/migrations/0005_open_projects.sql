-- Members of an open organization log time without an assignment, so there's no rate to bill.
-- The rule spans two tables, which a check constraint can't see. Deferred to commit, so a
-- project can be closed and made billable, or the reverse, in either order.
create function open_projects_not_billable() returns trigger
language plpgsql
as $$
declare
  changed_project_id bigint;
begin
  if tg_table_name = 'projects' then
    changed_project_id := new.id;
  else
    changed_project_id := new.project_id;
  end if;
  if exists (
    select from project_organizations
    join projects on projects.id = project_organizations.project_id
    where projects.id = changed_project_id
      and projects.billable
      and project_organizations.open_to_members
  ) then
    raise exception 'Billable projects can''t be open to an organization''s members'
      using errcode = 'check_violation', constraint = 'open_projects_not_billable';
  end if;
  return null;
end;
$$;
--> statement-breakpoint

create constraint trigger open_projects_not_billable
after insert or update of billable on projects
deferrable initially deferred
for each row
execute function open_projects_not_billable();
--> statement-breakpoint

create constraint trigger open_projects_not_billable
after insert or update of open_to_members, project_id on project_organizations
deferrable initially deferred
for each row
execute function open_projects_not_billable();
