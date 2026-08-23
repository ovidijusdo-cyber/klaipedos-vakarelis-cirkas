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
