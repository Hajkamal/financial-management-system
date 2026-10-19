// Single source of truth for the Gemini model used by the AI proxy route (/api/gemini/analyze).
// The server may override it with the GEMINI_MODEL environment variable and reports the model it
// actually used in the response, so the UI never advertises a model that is not in use.
// NOTE: 'gemini-2.5-flash' is no longer available to new API keys (2026); use the current one and
// bump this constant when Google announces a successor.
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
