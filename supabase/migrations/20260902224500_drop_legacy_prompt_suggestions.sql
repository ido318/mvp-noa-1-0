-- The prompt-learning-loop feature was renamed to tomer_prompt_suggestions
-- (see 20260831140000_tomer_prompt_suggestions.sql) before any code ever read
-- from or wrote to public.prompt_suggestions. That original table (created by
-- 20260828000022_prompt_learning_loop.sql) has zero live references anywhere
-- in agent/ or app/ and is dropped here as dead schema.
drop table if exists public.prompt_suggestions;
