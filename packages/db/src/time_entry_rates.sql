-- The rate a new entry on this task and day gets: the latest assignment rate that has started,
-- in the currency of the user's organization. No row when the assignment has no rate.
create function entry_rate(entry_user_id bigint, entry_task_id bigint, entry_spent_on date)
returns table (rate integer, currency char(3))
language sql stable
as $$
  select assignment_rates.rate, organizations.currency
  from tasks
  join assignment_rates
    on assignment_rates.project_id = tasks.project_id
    and assignment_rates.user_id = entry_user_id
    and assignment_rates.valid_from <= entry_spent_on
  join users         on users.id = entry_user_id
  join organizations on organizations.id = users.org_id
  where tasks.id = entry_task_id
  order by assignment_rates.valid_from desc
  limit 1
$$;
--> statement-breakpoint

-- Moving an entry to another task or project prices it again; changing its minutes doesn't.
-- In the database, so it holds for every writer.
create function time_entries_reprice() returns trigger
language plpgsql
as $$
begin
  new.rate := null;
  new.currency := null;
  select rate, currency into new.rate, new.currency
  from entry_rate(new.user_id, new.task_id, new.spent_on);
  return new;
end;
$$;
--> statement-breakpoint

create trigger time_entries_reprice
before update of task_id on time_entries
for each row
when (new.task_id is distinct from old.task_id)
execute function time_entries_reprice();
