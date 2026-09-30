create table organizations (
  id               bigint generated always as identity primary key,
  slug             text not null unique,
  name             text not null,
  currency         char(3) not null,
  full_day_minutes integer not null check (full_day_minutes between 1 and 1440)
);

create table users (
  id         bigint generated always as identity primary key,
  name       text not null,
  email      text not null,
  org_id     bigint not null references organizations (id),
  ends_on    date,
  created_at timestamptz not null default now(),
  -- Lets assignments check that the user belongs to the organization they're assigned through.
  unique (id, org_id)
);

-- The reporting database identifies people by email, so it must be unique regardless of case.
create unique index users_email_unique on users (lower(email));
create index users_org_id on users (org_id);

create type user_role as enum ('manager');

create table user_roles (
  user_id bigint not null references users (id),
  role    user_role not null,
  primary key (user_id, role)
);

create table user_identities (
  id        bigint generated always as identity primary key,
  user_id   bigint not null references users (id),
  provider  text not null,
  tenant_id text not null,
  subject   text not null,
  unique (provider, tenant_id, subject)
);

create table sessions (
  id         bigint generated always as identity primary key,
  token_hash text not null unique,
  user_id    bigint not null references users (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_user_id on sessions (user_id);

-- Clients and projects are shared across organizations. A client found in several
-- Harvest accounts becomes one row; downstream reporting matches on project code.
create table clients (
  id   bigint generated always as identity primary key,
  name text not null unique
);

create table projects (
  id               bigint generated always as identity primary key,
  client_id        bigint not null references clients (id),
  -- Used outside the app, and the reporting database holds at most 16 characters.
  code             text not null unique check (length(code) <= 16),
  name             text not null,
  billable         boolean not null,
  open_to_everyone boolean not null default false, -- across all organizations
  starts_on        date,
  ends_on          date,
  unique (client_id, name),
  check (not (open_to_everyone and billable)),
  check (ends_on >= starts_on)
);

create table project_organizations (
  project_id bigint not null references projects (id),
  org_id     bigint not null references organizations (id),
  is_owner   boolean not null default false,
  primary key (project_id, org_id)
);

create unique index project_organizations_one_owner
  on project_organizations (project_id) where is_owner;

create table tasks (
  id         bigint generated always as identity primary key,
  project_id bigint not null references projects (id),
  name       text not null,
  ends_on    date,
  unique (project_id, name)
);

-- Only users from a participating organization may be assigned to the project: org_id must
-- be both the user's organization and one of the project's.
create table project_assignments (
  project_id bigint not null,
  user_id    bigint not null,
  org_id     bigint not null,
  starts_on  date,
  ends_on    date,
  primary key (project_id, user_id),
  foreign key (user_id, org_id) references users (id, org_id),
  foreign key (project_id, org_id) references project_organizations (project_id, org_id),
  check (ends_on >= starts_on)
);

create index project_assignments_user_id on project_assignments (user_id);

-- The rate for an entry is the latest one with valid_from <= spent_on.
create table assignment_rates (
  project_id bigint not null,
  user_id    bigint not null,
  valid_from date not null,
  rate       integer not null check (rate >= 0), -- minor units of the organization's currency
  primary key (project_id, user_id, valid_from),
  foreign key (project_id, user_id) references project_assignments (project_id, user_id)
);

-- One row per user, task and day, with one note for the day.
-- Users must be assigned to the project unless it's open to everyone. The app enforces
-- this rather than the database, so it can tell the user why an entry was rejected.
create table time_entries (
  id        bigint generated always as identity primary key,
  user_id   bigint not null references users (id),
  task_id   bigint not null references tasks (id),
  spent_on  date not null,
  minutes   integer not null check (minutes between 0 and 1440),
  notes     text,
  unique (user_id, task_id, spent_on)
);

create index time_entries_task_id on time_entries (task_id);

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
