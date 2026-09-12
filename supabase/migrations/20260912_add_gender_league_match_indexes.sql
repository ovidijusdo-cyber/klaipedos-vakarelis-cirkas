create index if not exists kvadratas_league_matches_group_a_idx
  on public.kvadratas_league_matches (group_a_code);

create index if not exists kvadratas_league_matches_group_b_idx
  on public.kvadratas_league_matches (group_b_code);
