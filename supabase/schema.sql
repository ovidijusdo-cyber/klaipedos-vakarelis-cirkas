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
