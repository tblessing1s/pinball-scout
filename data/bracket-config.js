/**
 * Bracket tournament configuration.
 * BRACKET_FACTORS defines the three judging rounds (feel, vibe, legacy).
 * BUDGET_BANDS are the options shown when the user hasn't set a budget yet.
 */

export const BRACKET_FACTORS = [
  {
    id: "feel",
    question: "Which sounds more satisfying to play right now?",
    eyebrow: "Game feel",
    getBlurb: (m) => m.why_like_it || m.description || "",
    getDetail: () => null
  },
  {
    id: "vibe",
    question: "Which personality would you love living in your house?",
    eyebrow: "Theme & personality",
    getBlurb: (m) => m.description || "",
    getDetail: (m) => m.theme || null
  },
  {
    id: "legacy",
    question: "Which would you still be obsessed with in a year?",
    eyebrow: "Long-term ownership",
    getBlurb: (m) => m.best_for || m.description || "",
    getDetail: (m) => m.considerations ? `Worth knowing: ${m.considerations}` : null
  }
];

export const BUDGET_BANDS = [
  { id: "under5k",  label: "Under $5k",   desc: "Budget classic market" },
  { id: "5k-8k",    label: "$5k–$8k",     desc: "Mid-range, most Stern Pros" },
  { id: "8k-12k",   label: "$8k–$12k",    desc: "Premium modern & remakes" },
  { id: "over12k",  label: "$12k+",       desc: "High-end and Jersey Jack" },
  { id: "flexible", label: "I'm flexible", desc: "Show me the best fit" }
];
