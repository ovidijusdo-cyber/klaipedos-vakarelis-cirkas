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
  max_players integer not null default 7,
  constraint kvadratas_teams_name_length check (char_length(name) between 1 and 60),
  constraint kvadratas_teams_sort_order_range check (sort_order between 0 and 1000),
  constraint kvadratas_teams_max_players_range check (max_players between 2 and 30)
);

alter table public.kvadratas_teams
  add column if not exists max_players integer not null default 7;

do $$
begin
  alter table public.kvadratas_teams
    add constraint kvadratas_teams_max_players_range
    check (max_players between 2 and 30);
exception
  when duplicate_object then null;
end;
$$;

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
  skill_level text check (skill_level in ('A', 'B', 'C', 'D')),
  arrived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kvadratas_players_first_name_length check (char_length(first_name) between 1 and 80),
  constraint kvadratas_players_last_name_length check (char_length(last_name) between 1 and 80)
);

alter table public.kvadratas_players
  add column if not exists skill_level text;

alter table public.kvadratas_players
  add column if not exists arrived boolean not null default false;

do $$
begin
  alter table public.kvadratas_players
    add constraint kvadratas_players_skill_level_check
    check (skill_level in ('A', 'B', 'C', 'D'));
exception
  when duplicate_object then null;
end;
$$;

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
  ('Komanda A1', 10),
  ('Komanda B2', 20),
  ('Komanda C3', 30),
  ('Komanda D4', 40),
  ('Komanda E5', 50),
  ('Komanda F6', 60)
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

create table if not exists public.kvadratas_matches (
  id uuid primary key default gen_random_uuid(),
  court text not null default 'Aikštelė',
  starts_at timestamptz not null,
  team_a_id uuid not null references public.kvadratas_teams(id) on delete cascade,
  team_b_id uuid not null references public.kvadratas_teams(id) on delete cascade,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  status text not null default 'scheduled',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kvadratas_matches_different_teams check (team_a_id <> team_b_id),
  constraint kvadratas_matches_score_range check (
    team_a_score between 0 and 999 and team_b_score between 0 and 999
  ),
  constraint kvadratas_matches_status_check check (status in ('scheduled', 'live', 'finished')),
  constraint kvadratas_matches_court_length check (char_length(court) between 1 and 60)
);

create index if not exists kvadratas_matches_schedule_idx
  on public.kvadratas_matches (starts_at, sort_order);

create index if not exists kvadratas_matches_team_a_idx
  on public.kvadratas_matches (team_a_id);

create index if not exists kvadratas_matches_team_b_idx
  on public.kvadratas_matches (team_b_id);

alter table public.kvadratas_matches enable row level security;
revoke all on table public.kvadratas_matches from anon, authenticated;
grant select, insert, update, delete on table public.kvadratas_matches to service_role;

create table if not exists public.kvadratas_league_groups (
  code text primary key,
  division text not null,
  name text not null,
  sort_order integer not null,
  captain_player_id uuid references public.kvadratas_players(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kvadratas_league_groups_code_check check (code in ('M1', 'M2', 'V1', 'V2')),
  constraint kvadratas_league_groups_division_check check (division in ('women', 'men')),
  constraint kvadratas_league_groups_name_length check (char_length(name) between 1 and 60)
);

create unique index if not exists kvadratas_league_groups_captain_idx
  on public.kvadratas_league_groups (captain_player_id)
  where captain_player_id is not null;

insert into public.kvadratas_league_groups (code, division, name, sort_order)
values
  ('M1', 'women', 'Moterų M1', 10),
  ('M2', 'women', 'Moterų M2', 20),
  ('V1', 'men', 'Vyrų V1', 30),
  ('V2', 'men', 'Vyrų V2', 40)
on conflict (code) do update
set division = excluded.division,
    name = excluded.name,
    sort_order = excluded.sort_order;

create table if not exists public.kvadratas_league_roster (
  player_id uuid primary key references public.kvadratas_players(id) on delete cascade,
  group_code text not null references public.kvadratas_league_groups(code) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists kvadratas_league_roster_group_idx
  on public.kvadratas_league_roster (group_code);

create table if not exists public.kvadratas_league_matches (
  id uuid primary key default gen_random_uuid(),
  division text not null unique,
  group_a_code text not null references public.kvadratas_league_groups(code) on delete restrict,
  group_b_code text not null references public.kvadratas_league_groups(code) on delete restrict,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  status text not null default 'scheduled',
  sort_order integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kvadratas_league_matches_division_check check (division in ('women', 'men')),
  constraint kvadratas_league_matches_different_groups check (group_a_code <> group_b_code),
  constraint kvadratas_league_matches_score_range check (team_a_score between 0 and 999 and team_b_score between 0 and 999),
  constraint kvadratas_league_matches_status_check check (status in ('scheduled', 'live', 'finished'))
);

create index if not exists kvadratas_league_matches_group_a_idx
  on public.kvadratas_league_matches (group_a_code);

create index if not exists kvadratas_league_matches_group_b_idx
  on public.kvadratas_league_matches (group_b_code);

insert into public.kvadratas_league_matches (division, group_a_code, group_b_code, sort_order)
values
  ('women', 'M1', 'M2', 1000),
  ('men', 'V1', 'V2', 1010)
on conflict (division) do nothing;

create or replace function public.assign_kvadratas_league_group()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_division text;
  target_group text;
begin
  target_division := case when lower(new.first_name) ~ '[aė]$' then 'women' else 'men' end;
  select league_group.code into target_group
  from public.kvadratas_league_groups league_group
  left join public.kvadratas_league_roster roster on roster.group_code = league_group.code
  where league_group.division = target_division
  group by league_group.code, league_group.sort_order
  order by count(roster.player_id), league_group.sort_order
  limit 1;
  if target_group is not null then
    insert into public.kvadratas_league_roster (player_id, group_code)
    values (new.id, target_group)
    on conflict (player_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_kvadratas_league_group() from public, anon, authenticated;
grant execute on function public.assign_kvadratas_league_group() to service_role;

drop trigger if exists kvadratas_players_assign_league_group on public.kvadratas_players;
create trigger kvadratas_players_assign_league_group
  after insert on public.kvadratas_players
  for each row execute function public.assign_kvadratas_league_group();

with classified as (
  select player.id, case when lower(player.first_name) ~ '[aė]$' then 'women' else 'men' end as division, player.created_at
  from public.kvadratas_players player
), ranked as (
  select classified.*, row_number() over (partition by classified.division order by classified.created_at, classified.id) as position
  from classified
)
insert into public.kvadratas_league_roster (player_id, group_code)
select ranked.id,
  case
    when ranked.division = 'women' and ranked.position % 2 = 1 then 'M1'
    when ranked.division = 'women' then 'M2'
    when ranked.position % 2 = 1 then 'V1'
    else 'V2'
  end
from ranked
on conflict (player_id) do nothing;

alter table public.kvadratas_league_groups enable row level security;
alter table public.kvadratas_league_roster enable row level security;
alter table public.kvadratas_league_matches enable row level security;
revoke all on table public.kvadratas_league_groups from anon, authenticated;
revoke all on table public.kvadratas_league_roster from anon, authenticated;
revoke all on table public.kvadratas_league_matches from anon, authenticated;
grant select, insert, update, delete on table public.kvadratas_league_groups to service_role;
grant select, insert, update, delete on table public.kvadratas_league_roster to service_role;
grant select, insert, update, delete on table public.kvadratas_league_matches to service_role;

create table if not exists public.kvadratas_backups (
  id bigserial primary key,
  backup_date date not null unique,
  teams jsonb not null default '[]'::jsonb,
  players jsonb not null default '[]'::jsonb,
  matches jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.kvadratas_backups
  add column if not exists matches jsonb not null default '[]'::jsonb;

alter table public.kvadratas_backups
  add column if not exists league_groups jsonb not null default '[]'::jsonb,
  add column if not exists league_roster jsonb not null default '[]'::jsonb,
  add column if not exists league_matches jsonb not null default '[]'::jsonb;

alter table public.kvadratas_backups enable row level security;
revoke all on table public.kvadratas_backups from anon, authenticated;
grant select, insert, update, delete on table public.kvadratas_backups to service_role;
