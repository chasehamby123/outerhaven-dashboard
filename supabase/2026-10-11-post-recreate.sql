-- Literal render spec of a post's creative (11 Oct 2026, Tengku): every page as layers (exact text, fonts, colours, positions,
-- images, shapes) + a ready prompt, so a post can be rebuilt in GPT image with little touching up. Written by the weekly
-- analysis (post-breakdown skill, part B). `breakdown` holds the comparable parts; `recreate` holds the literal copy.
alter table public.daily_ops_posts add column if not exists recreate jsonb;
