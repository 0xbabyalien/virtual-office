// ===== EDIT THESE =====
export const X_HANDLE = "0xbabyalien";
export const QUEST_POST = `https://x.com/${X_HANDLE}/status/REPLACE_WITH_POST_ID`; // the post people must like / retweet / reply to
export const X_PROFILE = `https://x.com/${X_HANDLE}`;
// ======================

const RESERVED = ["home", "i", "explore", "search", "settings", "notifications", "messages", "intent", "share"];
const HOST = "https?:\\/\\/(?:www\\.|mobile\\.)?(?:x|twitter)\\.com\\/";

// Accepts https://x.com/name, twitter.com/name, @name or name. Returns the handle or null.
export function parseProfile(input: string): string | null {
  const v = input.trim();
  const plain = v.match(/^@?([A-Za-z0-9_]{1,15})$/);
  const url = v.match(new RegExp(`^${HOST}([A-Za-z0-9_]{1,15})\\/?(?:\\?.*)?$`, "i"));
  const h = plain?.[1] ?? url?.[1] ?? null;
  return h && !RESERVED.includes(h.toLowerCase()) ? h : null;
}

// Accepts https://x.com/name/status/123... Returns { handle, id } or null.
export function parseStatus(input: string): { handle: string; id: string } | null {
  const m = input.trim().match(new RegExp(`^${HOST}([A-Za-z0-9_]{1,15})\\/status\\/(\\d{5,25})(?:[/?#].*)?$`, "i"));
  return m ? { handle: m[1], id: m[2] } : null;
}
