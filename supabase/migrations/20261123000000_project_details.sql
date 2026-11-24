-- Answers from the homeowner's "new project" questionnaire
-- (project type, size, rooms, finish level, timing, budget…).
alter table jobs add column if not exists details jsonb not null default '{}'::jsonb;
