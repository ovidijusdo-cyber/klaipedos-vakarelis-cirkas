create table if not exists public.event_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_state_backups (
  id bigserial primary key,
  state_id text not null default 'main',
  backup_date date not null,
  payload jsonb not null,
  source_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (state_id, backup_date)
);

create or replace function public.set_event_state_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_event_state_updated_at on public.event_state;

create trigger trg_event_state_updated_at
before update on public.event_state
for each row
execute function public.set_event_state_updated_at();

insert into public.event_state (id, payload)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.event_state enable row level security;
revoke all on table public.event_state from anon, authenticated;
grant select, insert, update, delete on table public.event_state to service_role;

alter table public.event_state_backups enable row level security;
revoke all on table public.event_state_backups from anon, authenticated;
grant select, insert, update, delete on table public.event_state_backups to service_role;

create table if not exists public.movie_seat_holds (
  seat_id text primary key,
  hold_token uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint movie_seat_holds_seat_id_length check (char_length(seat_id) between 3 and 12)
);

create index if not exists movie_seat_holds_expires_at_idx
  on public.movie_seat_holds (expires_at);

alter table public.movie_seat_holds enable row level security;
revoke all on table public.movie_seat_holds from anon, authenticated;
grant select, insert, update, delete on table public.movie_seat_holds to service_role;

create table if not exists public.movie_waitlist (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'cancelled')),
  notified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint movie_waitlist_first_name_length check (char_length(first_name) between 1 and 80),
  constraint movie_waitlist_last_name_length check (char_length(last_name) between 1 and 80),
  constraint movie_waitlist_email_length check (char_length(email) between 3 and 254)
);

create unique index if not exists movie_waitlist_waiting_email_idx
  on public.movie_waitlist (lower(email))
  where status = 'waiting';

create index if not exists movie_waitlist_status_created_at_idx
  on public.movie_waitlist (status, created_at);

alter table public.movie_waitlist enable row level security;
revoke all on table public.movie_waitlist from anon, authenticated;
grant select, insert, update, delete on table public.movie_waitlist to service_role;

create table if not exists public.kvadratas_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  captain_player_id uuid,
  captain_code_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kvadratas_teams_name_length check (char_length(name) between 1 and 60),
  constraint kvadratas_teams_sort_order_range check (sort_order between 0 and 1000)
);

create unique index if not exists kvadratas_teams_name_idx
  on public.kvadratas_teams (lower(name));

create unique index if not exists kvadratas_teams_captain_idx
  on public.kvadratas_teams (captain_player_id)
  where captain_player_id is not null;

create table if not exists public.kvadratas_players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  preferred_team_id uuid references public.kvadratas_teams(id) on delete set null,
  assigned_team_id uuid references public.kvadratas_teams(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kvadratas_players_first_name_length check (char_length(first_name) between 1 and 80),
  constraint kvadratas_players_last_name_length check (char_length(last_name) between 1 and 80)
);

create unique index if not exists kvadratas_players_name_idx
  on public.kvadratas_players (lower(first_name), lower(last_name));

create index if not exists kvadratas_players_preferred_team_idx
  on public.kvadratas_players (preferred_team_id);

create index if not exists kvadratas_players_assigned_team_idx
  on public.kvadratas_players (assigned_team_id);

do $$
begin
  alter table public.kvadratas_teams
    add constraint kvadratas_teams_captain_player_fk
    foreign key (captain_player_id)
    references public.kvadratas_players(id)
    on delete set null;
exception
  when duplicate_object then null;
end;
$$;

insert into public.kvadratas_teams (name, sort_order)
select defaults.name, defaults.sort_order
from (values
  ('Komanda A', 10),
  ('Komanda B', 20),
  ('Komanda C', 30),
  ('Komanda D', 40),
  ('Komanda E', 50),
  ('Komanda F', 60)
) as defaults(name, sort_order)
where not exists (
  select 1 from public.kvadratas_teams team where lower(team.name) = lower(defaults.name)
);

alter table public.kvadratas_teams enable row level security;
revoke all on table public.kvadratas_teams from anon, authenticated;
grant select, insert, update, delete on table public.kvadratas_teams to service_role;

alter table public.kvadratas_players enable row level security;
revoke all on table public.kvadratas_players from anon, authenticated;
grant select, insert, update, delete on table public.kvadratas_players to service_role;

create table if not exists public.kvadratas_backups (
  id bigserial primary key,
  backup_date date not null unique,
  teams jsonb not null default '[]'::jsonb,
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.kvadratas_backups enable row level security;
revoke all on table public.kvadratas_backups from anon, authenticated;
grant select, insert, update, delete on table public.kvadratas_backups to service_role;
