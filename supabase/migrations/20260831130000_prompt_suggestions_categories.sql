-- Stage 2: category-aware prompt suggestions. Only category='prompt' rows
-- carry a full suggested_prompt and go through ElevenLabs regression+publish
-- in PromptSuggestionService.approve(); everything else is marked
-- 'approved' for manual follow-through (KB doc edit, tool change, etc).
alter table public.prompt_suggestions add column category text not null default 'prompt'
  check (category in ('prompt','knowledge_base','tool','backend_logic','conversation_flow'));
alter table public.prompt_suggestions add column target_file text;
alter table public.prompt_suggestions add column root_cause text;
alter table public.prompt_suggestions add column proposed_change text;
alter table public.prompt_suggestions alter column suggested_prompt drop not null;

comment on column public.prompt_suggestions.category is
  'What kind of fix this is — only "prompt" suggestions get auto-published via ElevenLabs regression+publish; everything else is marked approved for manual follow-through.';
