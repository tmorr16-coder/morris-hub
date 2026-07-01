---
name: feedback-model-choice
description: Terry's preference on which Claude model to use for in-app features and general dev work
metadata:
  type: feedback
---

Default to Haiku (claude-haiku-4-5-20251001) for all routine development work on morrisai.family. Only escalate to Sonnet when the task genuinely requires deeper reasoning.

**Why:** Cost efficiency and speed. This project has sustained, high-volume development and Haiku handles most tasks well.

**How to apply:**
- Routine edits, bug fixes, UI changes, SQL migrations, component syncs → Haiku
- First-pass architecture on a new feature, complex multi-file refactors, subtle logic debugging, security reviews → Sonnet
- Never use Opus for this project unless the user explicitly asks

User sets model via `/model haiku` in Claude Code CLI or `"model": "claude-haiku-4-5-20251001"` in `~/.claude/settings.json`.
