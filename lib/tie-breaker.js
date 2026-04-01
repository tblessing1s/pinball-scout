const QUESTION_BANK = {
  beginner_fit: {
    label: "Learning curve comfort",
    text: "Which machine feels easier to live with in your first 6 months?",
    options: {
      a: "Machine A feels easier",
      b: "Machine B feels easier",
      both: "About the same"
    }
  },
  resale_strength: {
    label: "Regret protection",
    text: "If your taste changes, which machine feels safer to exit with less regret?",
    options: {
      a: "Machine A feels safer",
      b: "Machine B feels safer",
      both: "About the same"
    }
  },
  maintenance_ease: {
    label: "Ownership effort",
    text: "Which machine are you more comfortable maintaining as a first-time owner?",
    options: {
      a: "Machine A seems easier",
      b: "Machine B seems easier",
      both: "About the same"
    }
  },
  theme_pull: {
    label: "Emotional excitement",
    text: "Which machine are you more excited to walk up to every day?",
    options: {
      a: "Machine A excites me more",
      b: "Machine B excites me more",
      both: "About the same"
    }
  },
  gameplay_depth: {
    label: "Long-term depth",
    text: "Which machine feels more likely to stay engaging over time?",
    options: {
      a: "Machine A has better long-term pull",
      b: "Machine B has better long-term pull",
      both: "About the same"
    }
  },
  price_certainty: {
    label: "Price confidence",
    text: "Which machine feels more predictable on total cost right now?",
    options: {
      a: "Machine A is more predictable",
      b: "Machine B is more predictable",
      both: "About the same"
    }
  }
};

const PRESET_PRIMARY_FACTOR = {
  balanced: "beginner_fit",
  "lowest-regret": "resale_strength",
  "most-excitement": "theme_pull",
  "easiest-ownership": "maintenance_ease"
};

const QUESTION_WEIGHTS = [0.4, 0.35, 0.25];

function uniquePush(list, value) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function riskDrivenFactor({ readinessA, readinessB, factorDeltas = {} }) {
  if (readinessA !== "Ready to proceed" || readinessB !== "Ready to proceed") {
    return "maintenance_ease";
  }

  const priceDelta = Math.abs(factorDeltas.price_certainty || 0);
  if (priceDelta > 0.13) return "price_certainty";

  const resaleDelta = Math.abs(factorDeltas.resale_strength || 0);
  if (resaleDelta > 0.12) return "resale_strength";

  return "beginner_fit";
}

function highestDisagreementFactor(factorDeltas = {}) {
  return Object.entries(factorDeltas)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))[0]?.[0] || "beginner_fit";
}

export function selectTieBreakerQuestions({
  presetMode = "balanced",
  factorDeltas = {},
  readinessA = "",
  readinessB = ""
} = {}) {
  const first = highestDisagreementFactor(factorDeltas);
  const second = PRESET_PRIMARY_FACTOR[presetMode] || PRESET_PRIMARY_FACTOR.balanced;
  const third = riskDrivenFactor({ readinessA, readinessB, factorDeltas });

  const factorIds = [];
  uniquePush(factorIds, first);
  uniquePush(factorIds, second);
  uniquePush(factorIds, third);

  Object.keys(QUESTION_BANK).forEach((factor) => uniquePush(factorIds, factor));

  const selectedFactors = factorIds.slice(0, 3);
  return selectedFactors.map((factor, index) => ({
    id: `q${index + 1}_${factor}`,
    factor,
    weight: QUESTION_WEIGHTS[index],
    ...QUESTION_BANK[factor]
  }));
}

export function tieBreakerRationale(questions = []) {
  const labels = questions.map((question) => question.label.toLowerCase());
  if (!labels.length) return "";
  if (labels.length === 1) return `This question targets your biggest remaining gap: ${labels[0]}.`;
  if (labels.length === 2) return `These questions target your biggest remaining gaps: ${labels[0]} and ${labels[1]}.`;
  return `These 3 questions were selected because they are your biggest remaining gaps: ${labels[0]}, ${labels[1]}, and ${labels[2]}.`;
}

export function applyTieBreakerAdjustment({ baseScores = {}, questions = [], responses = {} } = {}) {
  let a = Number(baseScores.a || 0);
  let b = Number(baseScores.b || 0);

  questions.forEach((question) => {
    const response = responses[question.id];
    const strength = Number(question.weight || 0) * 0.24;
    if (response === "a") a += strength;
    if (response === "b") b += strength;
  });

  return { a, b };
}
