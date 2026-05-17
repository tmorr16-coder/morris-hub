-- ============================================================
-- hub schema for morrisai.family (the apex hub app)
-- Isolated from finance.* and public.* — same Supabase project
-- ============================================================

create schema if not exists hub;

-- ------------------------------------------------------------
-- preferences : per-user personalization settings (location,
-- stock watchlist, news topics). One row per user.
-- ------------------------------------------------------------
create table if not exists hub.preferences (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  location_name     text,                   -- "Fishers, IN"
  latitude          numeric(7,4),           -- 39.9559
  longitude         numeric(7,4),           -- -85.9601
  stock_tickers     text[]  default '{}',   -- e.g. ['LLY','NVDA','MSFT']
  news_topics       text[]  default '{}',   -- e.g. ['politics','ai','claude']
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------
-- todos : personal to-do list
-- ------------------------------------------------------------
create table if not exists hub.todos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  title          text not null,
  completed      boolean not null default false,
  completed_at   timestamptz,
  due_date       date,
  notes          text,
  sort_order     integer default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists todos_user_idx on hub.todos(user_id, completed, sort_order);
create index if not exists todos_user_created_idx on hub.todos(user_id, created_at desc);

-- ------------------------------------------------------------
-- claude_tips : curated rotating Claude tips
-- Seeded with starter tips; admin can add more.
-- ------------------------------------------------------------
create table if not exists hub.claude_tips (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  category    text default 'general',    -- general | prompting | tools | workflow
  created_at  timestamptz not null default now()
);

-- Seed tips (idempotent — only inserts if title doesn't exist)
insert into hub.claude_tips (title, body, category)
select * from (values
  ('Prompt with examples',
   'Showing Claude 2-3 examples of input/output pairs ("few-shot prompting") is often more effective than describing the rules. The model picks up subtle conventions from examples that are hard to articulate.',
   'prompting'),
  ('Use the system prompt for stable instructions',
   'Put rules that should apply to every turn in the system prompt, not in user messages. Stable system prompts also enable prompt caching for major cost savings on long conversations.',
   'prompting'),
  ('Ask Claude to think before answering',
   'For hard reasoning, ask Claude to "think step by step" or use extended thinking. The reasoning becomes visible and the final answer is more accurate.',
   'prompting'),
  ('Give Claude a clear role',
   'Starting a system prompt with "You are an expert X" calibrates the tone and depth. Specifying the audience ("explain to a non-developer") tunes accessibility.',
   'prompting'),
  ('Iterate on the prompt, not the output',
   'When Claude''s answer is wrong, edit the prompt instead of telling Claude its answer was wrong. Iterating in conversation costs more tokens and rarely produces a robust prompt for reuse.',
   'workflow'),
  ('Use tools for anything dynamic',
   'Claude can call tools for live data — APIs, databases, file systems. Anything that changes after the training cutoff should come from a tool call, not the model''s memory.',
   'tools'),
  ('Cache the stable parts of long prompts',
   'For repeated requests with the same context (system prompt, large document, tool list), use prompt caching. Set `cache_control: ephemeral` on the last stable block. Cuts cost by 90% on cached reads.',
   'prompting'),
  ('Constrain output with structured formats',
   'For JSON or schema-shaped outputs, use `output_config.format` with a JSON schema. More reliable than asking "respond in JSON" in the prompt.',
   'tools'),
  ('Trim conversation history aggressively',
   'Long histories cost more and confuse the model. Keep only the last 6-10 turns unless the older context is load-bearing. Use compaction for very long sessions.',
   'workflow'),
  ('Test with Haiku before scaling to Opus',
   'Haiku 4.5 is 5x cheaper than Opus 4.7. If Haiku handles your task well, use it. Reserve Opus for tasks where Haiku noticeably underperforms.',
   'workflow')
) as v(title, body, category)
where not exists (select 1 from hub.claude_tips where claude_tips.title = v.title);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table hub.preferences  enable row level security;
alter table hub.todos        enable row level security;
alter table hub.claude_tips  enable row level security;

create policy "preferences: read own" on hub.preferences
  for select using (auth.uid() = user_id);
create policy "preferences: insert own" on hub.preferences
  for insert with check (auth.uid() = user_id);
create policy "preferences: update own" on hub.preferences
  for update using (auth.uid() = user_id);

create policy "todos: read own" on hub.todos
  for select using (auth.uid() = user_id);
create policy "todos: insert own" on hub.todos
  for insert with check (auth.uid() = user_id);
create policy "todos: update own" on hub.todos
  for update using (auth.uid() = user_id);
create policy "todos: delete own" on hub.todos
  for delete using (auth.uid() = user_id);

-- Claude tips are global / read-only to authenticated users
create policy "claude_tips: read all authenticated" on hub.claude_tips
  for select using (auth.role() = 'authenticated');

-- Grants
grant usage on schema hub to anon, authenticated, service_role;
grant select, insert, update, delete on hub.preferences, hub.todos to authenticated;
grant select on hub.claude_tips to authenticated;
grant all on all tables in schema hub to service_role;

-- updated_at trigger
create or replace function hub.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on hub.preferences;
create trigger set_updated_at before update on hub.preferences
  for each row execute function hub.set_updated_at();

drop trigger if exists set_updated_at on hub.todos;
create trigger set_updated_at before update on hub.todos
  for each row execute function hub.set_updated_at();
