export const CHECK_STATUS = {
  NOT_STARTED: "not_started",
  PARTIAL: "partial",
  SKIPPED: "skipped",
  COMPLETE: "complete"
};

export const CHECK_STATUS_VALUES = new Set(Object.values(CHECK_STATUS));

const USED_BLOCKERS = [
  {
    id: "used-price-verified",
    title: "Price is verified",
    whyThisMatters: "Used listing prices can vary a lot. Verifying total cost reduces regret.",
    doneWhen: "You have two comparable listings and your target price is in range after fees/shipping.",
    primaryActionLabel: "Verify used price",
    whatCounts: [
      "Two recent listings for the same title and trim.",
      "Out-the-door estimate includes shipping, tax, or setup when relevant.",
      "Your target is within your planned budget guardrail."
    ]
  },
  {
    id: "used-condition-evidence",
    title: "Condition evidence is documented",
    whyThisMatters: "Condition drives reliability and total cost more than headline price.",
    doneWhen: "You reviewed clear cabinet/playfield photos and service history evidence.",
    primaryActionLabel: "Document condition evidence",
    whatCounts: [
      "Recent photos of cabinet, playfield, and display.",
      "Proof of key repairs or board work when claimed.",
      "Known issues are explicitly listed, not implied."
    ]
  },
  {
    id: "used-seller-trust-confirmed",
    title: "Seller trust is confirmed",
    whyThisMatters: "A credible seller lowers risk of surprises and stalled communication.",
    doneWhen: "You confirmed seller identity, reputation, and response consistency.",
    primaryActionLabel: "Confirm seller trust",
    whatCounts: [
      "Consistent contact details across messages/listing.",
      "At least one credibility signal: references, history, or verified profile.",
      "Seller responds clearly to direct condition and ownership questions."
    ]
  },
  {
    id: "used-deal-terms-confirmed",
    title: "Deal terms are confirmed",
    whyThisMatters: "Clear terms prevent misunderstandings around payment, pickup, or disputes.",
    doneWhen: "Payment method, handoff/shipping terms, and issue-handling terms are written down.",
    primaryActionLabel: "Confirm deal terms",
    whatCounts: [
      "Payment method and timing agreed.",
      "Pickup or shipping responsibility is explicit.",
      "What happens if damage or mismatch is found is documented."
    ]
  }
];

const NEW_BLOCKERS = [
  {
    id: "new-final-quote-confirmed",
    title: "Final quote is confirmed",
    whyThisMatters: "Dealer quotes can change once fees and delivery are included.",
    doneWhen: "You have a written out-the-door quote with all major costs listed.",
    primaryActionLabel: "Confirm final quote",
    whatCounts: [
      "Machine price, shipping, tax, and install costs are itemized.",
      "Quote includes date and dealer contact.",
      "No major cost line is left as TBD."
    ]
  },
  {
    id: "new-warranty-support-confirmed",
    title: "Warranty and support are confirmed",
    whyThisMatters: "First-time buyers need clear support expectations after delivery.",
    doneWhen: "You understand warranty scope, duration, and first support contact path.",
    primaryActionLabel: "Confirm warranty/support",
    whatCounts: [
      "Coverage period and excluded components are clear.",
      "Primary support contact and response expectations are known.",
      "Any install/setup support terms are documented."
    ]
  },
  {
    id: "new-delivery-timeline-confirmed",
    title: "Delivery timeline is confirmed",
    whyThisMatters: "Timeline uncertainty can disrupt budget and planning.",
    doneWhen: "Estimated ship and delivery windows are written with realistic ranges.",
    primaryActionLabel: "Confirm delivery timeline",
    whatCounts: [
      "Expected ship window is stated.",
      "Delivery lead-time assumptions are included.",
      "Delays and update cadence are explained."
    ]
  },
  {
    id: "new-deposit-cancel-confirmed",
    title: "Deposit and cancellation terms are confirmed",
    whyThisMatters: "Deposit policies affect your flexibility if circumstances change.",
    doneWhen: "Deposit amount, refund rules, and cancellation process are explicitly documented.",
    primaryActionLabel: "Confirm deposit/cancellation",
    whatCounts: [
      "Deposit amount and due date are clear.",
      "Refundability and cancellation windows are explicit.",
      "Any restocking or admin fees are disclosed."
    ]
  }
];

const REMOTE_OVERLAY_BLOCKERS = [
  {
    id: "remote-live-walkthrough",
    title: "Live walkthrough evidence is captured",
    whyThisMatters: "Remote buyers need stronger evidence when they cannot inspect in person first.",
    doneWhen: "You completed or reviewed a live walkthrough focused on condition and gameplay behavior.",
    primaryActionLabel: "Capture live walkthrough",
    whatCounts: [
      "Real-time video or equivalent live evidence is available.",
      "Seller demonstrates startup, gameplay, and known wear points.",
      "Follow-up questions are answered with new proof, not reused photos."
    ]
  },
  {
    id: "remote-shipping-insurance",
    title: "Shipping and insurance terms are confirmed",
    whyThisMatters: "Shipping risk is one of the largest remote-buy failure points.",
    doneWhen: "Carrier, packing standard, insurance coverage, and delivery responsibility are agreed.",
    primaryActionLabel: "Confirm shipping/insurance",
    whatCounts: [
      "Carrier and packing method are specified.",
      "Insurance amount and claim process are identified.",
      "Who owns damage risk at each handoff stage is clear."
    ]
  },
  {
    id: "remote-damage-dispute",
    title: "Damage and dispute process is confirmed",
    whyThisMatters: "Clear dispute steps reduce stress if the machine arrives in unexpected condition.",
    doneWhen: "You have written steps for reporting damage, evidence requirements, and resolution timing.",
    primaryActionLabel: "Confirm damage/dispute process",
    whatCounts: [
      "Required evidence (photos/video) and reporting deadline are known.",
      "First contact for disputes is identified.",
      "Refund, repair, or mediation path is documented."
    ]
  }
];

const ALL_BLOCKERS = [...USED_BLOCKERS, ...NEW_BLOCKERS, ...REMOTE_OVERLAY_BLOCKERS];

export function normalizeCheckStatus(value) {
  if (CHECK_STATUS_VALUES.has(value)) return value;
  return CHECK_STATUS.NOT_STARTED;
}

export function normalizeRequiredChecks(raw = {}) {
  if (!raw || typeof raw !== "object") return {};
  const next = {};
  Object.entries(raw).forEach(([id, value]) => {
    if (typeof id !== "string") return;
    next[id] = normalizeCheckStatus(value);
  });
  return next;
}

export function shouldApplyRemoteOverlay(context = {}) {
  return context.playAccess === "none" || context.travelWillingness === "local-only";
}

export function blockersForPath(pathType = "", includeRemoteOverlay = false) {
  const base = pathType === "used" ? USED_BLOCKERS : pathType === "new" ? NEW_BLOCKERS : [];
  if (!base.length) return [];
  return includeRemoteOverlay ? [...base, ...REMOTE_OVERLAY_BLOCKERS] : [...base];
}

export function blockerById(id = "") {
  return ALL_BLOCKERS.find((blocker) => blocker.id === id) || null;
}

export function blockerStatusLabel(status) {
  if (status === CHECK_STATUS.COMPLETE) return "Complete";
  if (status === CHECK_STATUS.PARTIAL) return "In progress";
  if (status === CHECK_STATUS.SKIPPED) return "Skipped";
  return "Not started";
}

export function blockerStatusTone(status) {
  if (status === CHECK_STATUS.COMPLETE) return "ok";
  if (status === CHECK_STATUS.PARTIAL) return "working";
  if (status === CHECK_STATUS.SKIPPED) return "warn";
  return "pending";
}

export function blockerProgress(blockers = [], requiredChecks = {}) {
  const statusById = {};
  let completeCount = 0;
  let startedCount = 0;
  let blockedCount = 0;

  blockers.forEach((blocker) => {
    const status = normalizeCheckStatus(requiredChecks[blocker.id]);
    statusById[blocker.id] = status;
    if (status === CHECK_STATUS.COMPLETE) completeCount += 1;
    if (status === CHECK_STATUS.PARTIAL || status === CHECK_STATUS.COMPLETE) startedCount += 1;
    if (status !== CHECK_STATUS.COMPLETE) blockedCount += 1;
  });

  return {
    total: blockers.length,
    completeCount,
    startedCount,
    blockedCount,
    statusById
  };
}

export function readinessFromBlockers({
  pathType = "",
  blockers = [],
  requiredChecks = {},
  currentPlanStep = 1,
  workingPickConfirmed = false
} = {}) {
  if (pathType === "still-deciding") {
    return {
      label: "Not ready",
      reason: "Choose used or new route to unlock required checks.",
      tone: "pending"
    };
  }

  const progress = blockerProgress(blockers, requiredChecks);
  if (!progress.total) {
    return {
      label: "Not ready",
      reason: "Select a buy path to begin required checks.",
      tone: "pending"
    };
  }

  if (progress.blockedCount > 0) {
    if (progress.startedCount > 0 || currentPlanStep >= 3) {
      return {
        label: "Near-ready, blocked",
        reason: `${progress.blockedCount} required check${progress.blockedCount === 1 ? "" : "s"} still need completion.`,
        tone: "warn"
      };
    }
    return {
      label: "Not ready",
      reason: "Start required checks first.",
      tone: "pending"
    };
  }

  if (!workingPickConfirmed || currentPlanStep < 4) {
    return {
      label: "Near-ready",
      reason: "Required checks are complete. Finish the plan flow before proceeding.",
      tone: "working"
    };
  }

  return {
    label: "Ready to proceed",
    reason: "All required checks are complete for this path.",
    tone: "ok"
  };
}
