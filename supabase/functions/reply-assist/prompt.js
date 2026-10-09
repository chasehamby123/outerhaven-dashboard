// Pure helpers for reply-assist (no network, no Deno APIs) so they can be tested in Node:
//   node scripts/tests/test_reply_prompt.mjs
// They prepare the job input; the writing rules live in routines/reply.md (the Claude Code routine writes the draft).
// The draft is ALWAYS reviewed and sent by a person. Nothing here sends or types anything on LinkedIn.

export const INTENTS = ["lead_magnet_request", "interested", "question", "objection", "scheduling", "no", "spam_or_irrelevant", "unclear"];

const clean = (v, max) => (typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "");
const words = (s) => String(s || "").toLowerCase().match(/[a-z0-9]{4,}/g) || [];
const STOP = new Set(["that", "this", "with", "have", "from", "your", "will", "would", "could", "about", "there", "their", "what", "when", "which", "thanks", "thank", "please", "hello", "just", "like", "send", "share", "free", "guide", "resource"]);

// Last messages of the thread, newest kept, bounded so one huge chat can't blow the prompt.
export function clipMessages(messages, maxMsgs = 30, perMsg = 1200, total = 12000) {
  const out = [];
  let used = 0;
  for (const m of (Array.isArray(messages) ? messages : []).slice(-maxMsgs).reverse()) {
    const text = clean(m?.text, perMsg);
    if (!text) continue;
    if (used + text.length > total) break;
    used += text.length;
    out.push({ from: m?.from === "us" ? "us" : "them", text, at: clean(m?.at, 40) });
  }
  return out.reverse();
}

// Which saved lead-magnet resources does this conversation look like it is about? Word overlap, best first.
export function pickResources(messages, resources, limit = 3) {
  const convo = new Set(words((messages || []).map((m) => m.text).join(" ")).filter((w) => !STOP.has(w)));
  return (resources || [])
    .map((r) => {
      const ws = [...new Set(words(`${r.title || ""} ${r.topic || ""} ${r.caption || ""}`).filter((w) => !STOP.has(w)))];
      const hits = ws.filter((w) => convo.has(w)).length;
      return { r, score: ws.length ? hits : 0 };
    })
    .filter((x) => x.score > 0 && x.r.url)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}

// Our side of a thread that ended in a meeting, trimmed to a short style sample.
export function exampleFrom(conv) {
  const ours = (Array.isArray(conv?.messages) ? conv.messages : []).filter((m) => m?.from === "us").slice(0, 4).map((m) => clean(m.text, 400)).filter(Boolean);
  return ours.length ? ours.join("\n---\n") : "";
}
