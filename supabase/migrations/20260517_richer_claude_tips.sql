-- Replace short tips with denser, more actionable ones, and add new tips
-- across more categories. Existing rows are kept (no destructive ops);
-- this migration just rewrites bodies of seeded titles and inserts new ones.

-- ------------------------------------------------------------
-- 1. Refresh bodies of the 10 originally seeded tips
-- ------------------------------------------------------------
update hub.claude_tips set body =
  'Show Claude 2-3 examples of input/output pairs rather than describing the rules. The model picks up subtle conventions from examples that are hard to articulate — tone, output structure, when to ask for clarification. A 5-line example block often replaces a 50-line spec.'
where title = 'Prompt with examples';

update hub.claude_tips set body =
  'Put rules that apply on every turn in the system prompt, not in user messages. Three concrete benefits: (1) keeps user messages focused, (2) enables prompt caching for 90% cost savings on long conversations, (3) makes the agent''s "personality" auditable in one place. If you find yourself re-pasting instructions, move them.'
where title = 'Use the system prompt for stable instructions';

update hub.claude_tips set body =
  'For multi-step reasoning, enable extended thinking with `thinking: {type: "adaptive"}`. Claude decides how much to think based on task complexity, you see the reasoning trace, and the final answer is calibrated against it. Particularly effective for code review, complex math, and ambiguous spec interpretation.'
where title = 'Ask Claude to think before answering';

update hub.claude_tips set body =
  'Start the system prompt with "You are an expert {role} who..." to calibrate tone and depth. Pair it with audience specification ("explain for a non-developer", "respond like a senior reviewer", "format for a Slack message"). Roles change retrieval and reasoning, not just style — try the same question with three different roles and watch the answers diverge.'
where title = 'Give Claude a clear role';

update hub.claude_tips set body =
  'When Claude''s answer is wrong, edit the prompt and re-run instead of arguing in the conversation. Conversation correction costs tokens, doesn''t produce a robust prompt you can reuse, and tends to over-fit to one example. Pretend each turn is a fresh start — what would the prompt need to say to get the right answer first try?'
where title = 'Iterate on the prompt, not the output';

update hub.claude_tips set body =
  'Anything dynamic should come from a tool call, not the model''s memory. That includes today''s weather, the current stock price, your database row, file contents, and search results. Claude''s training data has a cutoff and no memory of your private data — tools bridge that gap and produce auditable, sourced answers.'
where title = 'Use tools for anything dynamic';

update hub.claude_tips set body =
  'For repeated requests sharing a large prefix (system prompt, documentation, tool list), add `cache_control: {type: "ephemeral"}` to the last stable block. Cache reads cost ~10% of normal input tokens and persist for 5 minutes (refreshes on each hit). Order matters: stable content first, volatile content (questions, timestamps) last.'
where title = 'Cache the stable parts of long prompts';

update hub.claude_tips set body =
  'For schema-shaped outputs, use `output_config.format` with a JSON schema rather than asking "respond in JSON". The structured-output mode validates against your schema and won''t emit stray prose, code fences, or trailing commentary — much more reliable for downstream parsing. Define the schema once, reuse forever.'
where title = 'Constrain output with structured formats';

update hub.claude_tips set body =
  'Long histories are expensive and reduce focus. Keep the last 6-10 turns unless older context is load-bearing. For genuinely long sessions enable server-side compaction (beta header `compact-2026-01-12`) — Claude summarizes earlier turns automatically as you approach the context window, with no manual intervention needed.'
where title = 'Trim conversation history aggressively';

update hub.claude_tips set body =
  'Haiku 4.5 is 5x cheaper than Opus 4.7 and often as good for classification, extraction, short summaries, and chat with cached context. Build with Haiku first; only upgrade to Sonnet or Opus when you can point at a specific failure mode Haiku has. Cost discipline at the model layer is more impactful than any prompt optimization.'
where title = 'Test with Haiku before scaling to Opus';

-- ------------------------------------------------------------
-- 2. New tips across more categories
-- ------------------------------------------------------------
insert into hub.claude_tips (title, body, category)
select * from (values
  ('Stream long responses to dodge timeouts',
   'For any call that may take more than a few seconds — long generations, extended thinking, or tool-heavy agent loops — enable streaming. It prevents request timeouts, gives the user immediate feedback, and lets you abort early if the answer drifts. The SDK''s `.finalMessage()` helper returns the complete response if you don''t need event-by-event handling.',
   'workflow'),
  ('Pin the model ID explicitly',
   'Always pin to a specific model ID like `claude-haiku-4-5` rather than aliases. New models behave differently — slightly more conservative, different verbosity, different default thinking depth — and you don''t want your prompts to silently regress when Anthropic ships a new version. Treat model versions like dependency versions.',
   'models'),
  ('Give tools good descriptions, not just names',
   'A tool''s description is how Claude decides whether to call it. Write the description like a docstring: what it does, when to use it, when NOT to use it, what the inputs mean, what the output looks like. A tool with `description: "search the web"` will be called for everything; `description: "search the public web for current news and events; do not use for internal docs"` calls it only when appropriate.',
   'tools'),
  ('Use Haiku 4.5 as a sub-agent under Opus',
   'For agent loops where a planner-executor split makes sense: have Opus 4.7 plan and decide, then dispatch concrete sub-tasks to Haiku 4.5. You get Opus-quality judgment at execution-step Haiku cost — often 3-5x cheaper overall while preserving output quality on the parts that matter.',
   'cost'),
  ('Audit your token spend per feature',
   'Log `usage.input_tokens` and `usage.output_tokens` per request with a feature tag. When the bill arrives you can attribute cost to specific features and find waste — e.g. "the summary endpoint uses 8K input tokens per call but the summary itself is 200 tokens; the system prompt has 5K of stale instructions." You can''t optimize what you don''t measure.',
   'cost'),
  ('Default temperature is fine for most tasks',
   'Resist the urge to tune `temperature` unless you have a specific reason. The default (1) works well for chat, creative writing, and most analysis. Lower it (0-0.3) only for tasks that need exact determinism — JSON extraction, classification, math. Raising it rarely improves quality and makes outputs harder to debug.',
   'prompting'),
  ('Prompt caching has a 5-minute TTL',
   'Cached prompt prefixes live for 5 minutes after the last hit, then expire. For low-traffic features this means you''ll pay full price most of the time — caching only pays off when calls come faster than every 5 minutes. Either accept that or batch requests. Don''t assume caching is "free savings" without verifying your actual hit rate.',
   'cost'),
  ('Tell Claude what NOT to do',
   'Constraints are often clearer than affirmative instructions. "Do not invent URLs", "do not apologize before answering", "do not summarize what you just did" — these negative rules are usually shorter and more enforceable than long lists of what to do instead. Place them at the end of the system prompt where they''ll be most salient.',
   'prompting'),
  ('Use the Files API for repeated documents',
   'If you''re sending the same large PDF or document across many requests, upload it once via the Files API and reference it by ID. You pay for the upload once and skip the token cost of re-sending the document each time. Especially valuable for documents you''ll query interactively over a session.',
   'tools'),
  ('Test prompts against an adversarial input set',
   'Before shipping a prompt, run it against 10-20 inputs that include edge cases: empty strings, very long inputs, off-topic questions, attempts to bypass instructions, multi-language content, and ambiguous requests. Most prompt failures show up in this kind of testing, not in the happy-path examples you used to develop the prompt.',
   'workflow'),
  ('Reserve Opus for tasks where you can verify quality',
   'Use Opus when the cost of a wrong answer is high AND you can detect a wrong answer — code review where tests catch regressions, plan synthesis you''ll review before executing, complex analysis where the conclusion is auditable. Don''t pay Opus prices for tasks you can''t evaluate; you''ll never know if it''s worth the spend.',
   'models'),
  ('Use the Anthropic console for one-off prompt design',
   'For exploratory prompt iteration — testing variations, comparing models, debugging tool calls — use console.anthropic.com rather than your application. Faster feedback loop, side-by-side comparisons, and you can copy the final prompt into code when satisfied. Don''t prototype in your codebase.',
   'workflow')
) as v(title, body, category)
where not exists (select 1 from hub.claude_tips where claude_tips.title = v.title);
