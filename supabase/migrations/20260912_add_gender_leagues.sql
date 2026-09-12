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

  select league_group.code
    into target_group
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
  select
    player.id,
    case when lower(player.first_name) ~ '[aė]$' then 'women' else 'men' end as division,
    player.created_at
  from public.kvadratas_players player
), ranked as (
  select
    classified.*,
    row_number() over (partition by classified.division order by classified.created_at, classified.id) as position
  from classified
)
insert into public.kvadratas_league_roster (player_id, group_code)
select
  ranked.id,
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

alter table public.kvadratas_backups
  add column if not exists league_groups jsonb not null default '[]'::jsonb,
  add column if not exists league_roster jsonb not null default '[]'::jsonb,
  add column if not exists league_matches jsonb not null default '[]'::jsonb;
