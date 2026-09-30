-- Shaped like dbo.time_entries in the reporting database.
create view time_entries_export as
select
  organizations.name                                 as account_name,
  entry.spent_on                                     as spent_date,
  extract(year from entry.spent_on)::int             as spent_year,
  extract(month from entry.spent_on)::int            as spent_month,
  users.email                                        as user_email,
  users.name                                         as user_name,
  clients.name                                       as client_name,
  projects.code                                      as project_code,
  projects.name                                      as project_name,
  tasks.name                                         as task_name,
  projects.billable,
  hours.hours,
  hours.billable_hours,
  -- Assumed equal to billable_hours until we know what "base" means downstream.
  hours.billable_hours                               as billable_base_hours,
  rate.billable_rate,
  round(hours.billable_hours * rate.billable_rate, 2) as amount,
  to_char(entry.spent_on, 'IYYYIW')::int             as spent_year_week
from time_entries entry
join users         on users.id = entry.user_id
-- The user's organization did the work, so it bills in its currency.
join organizations on organizations.id = users.org_id
join tasks         on tasks.id = entry.task_id
join projects      on projects.id = tasks.project_id
join clients       on clients.id = projects.client_id
cross join lateral (
  select
    round(entry.minutes / 60.0, 2) as hours,
    case when projects.billable then round(entry.minutes / 60.0, 2) else 0 end as billable_hours
) hours
left join lateral (
  -- Assumes a currency with two decimals.
  select (assignment_rates.rate / 100.0)::numeric(18, 2) as billable_rate
  from assignment_rates
  where assignment_rates.project_id = projects.id
    and assignment_rates.user_id = entry.user_id
    and assignment_rates.valid_from <= entry.spent_on
  order by assignment_rates.valid_from desc
  limit 1
) rate on true;
