// The model behind the unscoped "Ask Morris" — it reasons across the whole
// platform. Shared so the chat route and the composer agree on what the default
// is, and the UI can name it rather than saying "default" and leaving you to
// guess. Scoped assistants (Career Advisor, Health, LSAT, Bible, …) live in
// their own routes and keep their own models.
export const ASK_MORRIS_MODEL = "claude-sonnet-5";
export const ASK_MORRIS_MODEL_LABEL = "Claude Sonnet 5";

/** Which brain answered a turn: the pinned default, or OpenRouter's Auto Router. */
export type Router = "default" | "auto";
