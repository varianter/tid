-- The one place that knows an unlocked row no longer locks, so the app and the trigger agree.
create function month_locked(lock_org_id bigint, day date) returns boolean
language sql stable
as $$
  select exists (
    select from month_locks
    where org_id = lock_org_id
      and month = date_trunc('month', day)::date
      and unlocked_at is null
  )
$$;
--> statement-breakpoint

-- Checks the old row too, so an entry can't be moved or deleted out of a locked month.
-- ponytail: an entry saved while its month is being locked can still commit. Lock the
-- organization row here if that race ever matters.
create function time_entries_check_month_lock() returns trigger
language plpgsql
as $$
declare
  entry time_entries;
begin
  foreach entry in array array[old, new] loop
    continue when entry is null;
    if month_locked((select org_id from users where id = entry.user_id), entry.spent_on) then
      raise exception 'Time entries in % are locked', to_char(entry.spent_on, 'YYYY-MM');
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;
--> statement-breakpoint

create trigger time_entries_check_month_lock
before insert or update or delete on time_entries
for each row
execute function time_entries_check_month_lock();
