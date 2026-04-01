import { normalizeRequiredChecks } from "./required-checks.js";
export const DECISION_PLAN_STEPS = [1, 2, 3, 4];

export const BUY_PATH_OPTIONS = [
  {
    value: "used",
    label: "Used listing route",
    hint: "Best when you want value and are open to condition checks."
  },
  {
    value: "new",
    label: "New / dealer route",
    hint: "Best when you want warranty coverage and simpler first ownership."
  },
  {
    value: "still-deciding",
    label: "Still deciding",
    hint: "Use a neutral action plan while you narrow one more step."
  }
];

function clampStep(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(4, Math.max(1, Math.round(parsed)));
}

export function defaultPathTypeFromContext(condition = "") {
  if (condition === "used") return "used";
  if (condition === "new") return "new";
  return "still-deciding";
}

export function normalizePathType(value = "", fallback = "still-deciding") {
  const option = BUY_PATH_OPTIONS.find((item) => item.value === value);
  return option ? option.value : fallback;
}

export function readMachinePlanState(decisionState, machineSlug, fallbackCondition = "") {
  const fallbackPath = defaultPathTypeFromContext(fallbackCondition);
  const perMachine = decisionState?.perMachinePlanState?.[machineSlug] || {};
  return {
    selectedPathType: normalizePathType(
      perMachine.selectedPathType || decisionState?.selectedPathType || fallbackPath,
      fallbackPath
    ),
    currentPlanStep: clampStep(perMachine.currentPlanStep || decisionState?.currentPlanStep || 1),
    workingPickConfirmed: Boolean(perMachine.workingPickConfirmed),
    requiredChecks: normalizeRequiredChecks(perMachine.requiredChecks)
  };
}

export function decisionPlanPatch(decisionState, machineSlug, patch, fallbackCondition = "") {
  const current = readMachinePlanState(decisionState, machineSlug, fallbackCondition);
  const next = {
    selectedPathType: normalizePathType(patch.selectedPathType ?? current.selectedPathType, current.selectedPathType),
    currentPlanStep: clampStep(patch.currentPlanStep ?? current.currentPlanStep),
    workingPickConfirmed: patch.workingPickConfirmed ?? current.workingPickConfirmed,
    requiredChecks: normalizeRequiredChecks(patch.requiredChecks ?? current.requiredChecks)
  };

  return {
    selectedPathType: next.selectedPathType,
    currentPlanStep: next.currentPlanStep,
    planLastUpdated: new Date().toISOString(),
    perMachinePlanState: {
      ...(decisionState?.perMachinePlanState || {}),
      [machineSlug]: {
        ...next,
        updatedAt: new Date().toISOString()
      }
    }
  };
}

export function decisionPlanProgress(step) {
  if (step <= 1) return 30;
  if (step === 2) return 52;
  if (step === 3) return 74;
  return 92;
}

export function decisionPlanStepTitle(step) {
  if (step === 1) return "Step 1: Your working pick";
  if (step === 2) return "Step 2: Why it fits and what could go wrong";
  if (step === 3) return "Step 3: Choose your buy path";
  return "Step 4: Next actions";
}

export function nextActionsForPath(pathType, machineName = "your machine") {
  if (pathType === "used") {
    return [
      `Find 2-3 credible used listings for ${machineName}.`,
      "Confirm condition notes, maintenance history, and all-in delivered price.",
      "Shortlist one seller and prepare your first outreach message."
    ];
  }

  if (pathType === "new") {
    return [
      `Request written out-the-door quotes for ${machineName} from one or two dealers.`,
      "Confirm warranty coverage, install options, and expected delivery window.",
      "Choose one dealer path and set a target decision date."
    ];
  }

  return [
    `Run one more validation step for ${machineName} (play test, video review, or side-by-side compare).`,
    "Pick your likely route: used value path or new/dealer path.",
    "Set a revisit checkpoint so your shortlist does not stall."
  ];
}

export function whoShouldSkip(machine) {
  if (!machine) return "";
  if (machine.beginnerFriendly <= 3) {
    return "Skip this if you want the easiest first-owner learning curve.";
  }
  if (machine.maintenanceComplexity >= 4) {
    return "Skip this if you want low-maintenance ownership for your first machine.";
  }
  if (machine.themeStrength >= 5) {
    return "Skip this if the theme does not strongly resonate with you.";
  }
  return "";
}
