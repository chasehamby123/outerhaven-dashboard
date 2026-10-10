-- Scoreboard (10 Oct 2026): map auth user ids (created_by / reviewed_by) to team first names. Admin only.
create or replace function public.team_user_names() returns table (id uuid, name text)
language sql stable security definer set search_path to 'public' as $$
  select u.id, coalesce(nullif(split_part(trim(d.full_name), ' ', 1), ''), initcap(split_part(split_part(u.email, '@', 1), '.', 1)))
  from auth.users u join public.dashboard_access d on lower(d.email) = lower(u.email)
  where public.can_access_dashboard()
$$;
grant execute on function public.team_user_names() to authenticated;
