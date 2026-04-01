import { loadDecisionState, sessionMode } from "./decision-state.js";
import { trackEvent } from "./utils.js";

export const ANALYTICS_EVENTS = {
  START_DISCOVERY_CLICKED: "start_discovery_clicked",
  RESUME_BANNER_CLICKED: "resume_banner_clicked",
  TOOLS_MENU_OPENED: "tools_menu_opened",
  GUARDRAILS_COMPLETED: "guardrails_completed",
  REACTION_SELECTED: "reaction_selected",
  REFLECTION_VIEWED: "reflection_viewed",
  DISCOVERY_COMPLETED: "discovery_completed",
  RESULTS_VIEWED: "results_viewed",
  PRIMARY_NEXT_STEP_CLICKED: "primary_next_step_clicked",
  MORE_ACTIONS_OPENED: "more_actions_opened",
  COMPARE_FROM_RESULTS: "compare_from_results",
  BUYING_PLAN_OPENED: "buying_plan_opened",
  PLAN_STEP_VIEWED: "plan_step_viewed",
  PLAN_STEP_COMPLETED: "plan_step_completed",
  HARD_BLOCKER_VIEWED: "hard_blocker_viewed",
  HARD_BLOCKER_RESOLVED: "hard_blocker_resolved",
  HARD_BLOCKER_REOPENED: "hard_blocker_reopened",
  FINAL_HARD_BLOCKER_COMPLETED: "final_hard_blocker_completed",
  WHAT_COUNTS_OPENED: "what_counts_opened",
  WHAT_COUNTS_CLOSED: "what_counts_closed",
  READINESS_METER_VIEWED: "readiness_meter_viewed",
  READINESS_CHIP_CLICKED: "readiness_chip_clicked",
  RISK_BANNER_CTA_CLICKED: "risk_banner_cta_clicked",
  COMPARE_VIEWED: "compare_viewed",
  COMPARE_PRESET_CHANGED: "compare_preset_changed",
  TOO_CLOSE_TRIGGERED: "too_close_triggered",
  TIE_BREAKER_STARTED: "tie_breaker_started",
  TIE_BREAKER_COMPLETED: "tie_breaker_completed",
  TEMPORARY_PRIMARY_SET: "temporary_primary_set",
  DECISION_BAR_ACTION_CLICKED: "decision_bar_action_clicked",
  BACKUP_PROMOTION_SHOWN: "backup_promotion_shown",
  BACKUP_PROMOTED: "backup_promoted",
  FRONT_RUNNER_SWITCHED: "front_runner_switched",
  TEMPORARY_PRIMARY_RESUMED: "temporary_primary_resumed"
};

export const ANALYTICS_SCHEMAS = {
  [ANALYTICS_EVENTS.START_DISCOVERY_CLICKED]: ["source", "session_mode"],
  [ANALYTICS_EVENTS.RESUME_BANNER_CLICKED]: ["state_type", "screen"],
  [ANALYTICS_EVENTS.TOOLS_MENU_OPENED]: ["screen", "session_mode"],
  [ANALYTICS_EVENTS.GUARDRAILS_COMPLETED]: ["budget_present", "path_known", "zip_present", "timeline_present"],
  [ANALYTICS_EVENTS.REACTION_SELECTED]: ["machine_slug", "reaction_type", "step_index"],
  [ANALYTICS_EVENTS.REFLECTION_VIEWED]: ["signal_level", "candidate_count"],
  [ANALYTICS_EVENTS.DISCOVERY_COMPLETED]: ["candidate_count", "has_zip", "play_access"],
  [ANALYTICS_EVENTS.RESULTS_VIEWED]: ["candidate_count", "strength_band", "front_runner_present"],
  [ANALYTICS_EVENTS.PRIMARY_NEXT_STEP_CLICKED]: ["cta_id", "machine_slug", "strength_band"],
  [ANALYTICS_EVENTS.MORE_ACTIONS_OPENED]: ["screen", "candidate_count"],
  [ANALYTICS_EVENTS.COMPARE_FROM_RESULTS]: ["machine_slug", "backup_count"],
  [ANALYTICS_EVENTS.BUYING_PLAN_OPENED]: ["machine_slug", "path_type", "temporary_primary"],
  [ANALYTICS_EVENTS.PLAN_STEP_VIEWED]: ["machine_slug", "step_id", "path_type"],
  [ANALYTICS_EVENTS.PLAN_STEP_COMPLETED]: ["machine_slug", "step_id", "path_type"],
  [ANALYTICS_EVENTS.HARD_BLOCKER_VIEWED]: ["machine_slug", "path_type", "blocker_type", "screen"],
  [ANALYTICS_EVENTS.HARD_BLOCKER_RESOLVED]: ["machine_slug", "path_type", "blocker_type", "time_to_resolve_sec"],
  [ANALYTICS_EVENTS.HARD_BLOCKER_REOPENED]: ["machine_slug", "blocker_type", "reason"],
  [ANALYTICS_EVENTS.FINAL_HARD_BLOCKER_COMPLETED]: ["machine_slug", "path_type", "time_from_plan_start_sec"],
  [ANALYTICS_EVENTS.WHAT_COUNTS_OPENED]: ["machine_slug", "blocker_type", "screen"],
  [ANALYTICS_EVENTS.WHAT_COUNTS_CLOSED]: ["machine_slug", "blocker_type", "screen", "duration_ms"],
  [ANALYTICS_EVENTS.READINESS_METER_VIEWED]: ["machine_slug", "path_type", "overall_state"],
  [ANALYTICS_EVENTS.READINESS_CHIP_CLICKED]: ["machine_slug", "chip_id", "target_step"],
  [ANALYTICS_EVENTS.RISK_BANNER_CTA_CLICKED]: ["machine_slug", "risk_type", "cta_id"],
  [ANALYTICS_EVENTS.COMPARE_VIEWED]: ["pair_count", "preset_mode", "too_close"],
  [ANALYTICS_EVENTS.COMPARE_PRESET_CHANGED]: ["from_mode", "to_mode", "winner_before", "winner_after"],
  [ANALYTICS_EVENTS.TOO_CLOSE_TRIGGERED]: ["mode", "score_delta", "machine_a", "machine_b", "both_ready"],
  [ANALYTICS_EVENTS.TIE_BREAKER_STARTED]: ["mode", "machine_a", "machine_b"],
  [ANALYTICS_EVENTS.TIE_BREAKER_COMPLETED]: ["winner", "delta_after", "duration_sec"],
  [ANALYTICS_EVENTS.TEMPORARY_PRIMARY_SET]: ["machine_slug", "other_machine_slug", "reason"],
  [ANALYTICS_EVENTS.DECISION_BAR_ACTION_CLICKED]: ["action_id", "screen", "front_runner", "temporary_primary"],
  [ANALYTICS_EVENTS.BACKUP_PROMOTION_SHOWN]: ["front_runner", "backup", "front_status", "backup_status", "reason_codes"],
  [ANALYTICS_EVENTS.BACKUP_PROMOTED]: ["from_slug", "to_slug", "reason_codes"],
  [ANALYTICS_EVENTS.FRONT_RUNNER_SWITCHED]: ["from_slug", "to_slug", "source"],
  [ANALYTICS_EVENTS.TEMPORARY_PRIMARY_RESUMED]: ["machine_slug", "screen"]
};

// In-memory page-session guards to prevent rerender/remount analytics spam.
const onceKeys = new Set();
const timers = new Map();

function normalizedProps(props = {}) {
  return Object.entries(props).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

export function deriveScreen(input = "") {
  if (input) return input;
  const path = String(window.location.pathname || "");
  if (path.endsWith("index.html") || path === "/" || path === "") return "home";
  if (path.endsWith("help.html")) return "help";
  if (path.endsWith("compare.html")) return "compare";
  if (path.endsWith("machines.html")) return "machines";
  if (path.endsWith("machine.html")) return "machine";
  if (path.endsWith("glossary.html")) return "glossary";
  return "unknown";
}

export function deriveSessionMode(state = loadDecisionState()) {
  return sessionMode(state);
}

export function derivePathType(pathType = "", fallback = "still-deciding") {
  return pathType || fallback;
}

export function trackAnalytics(eventName, props = {}) {
  trackEvent(eventName, normalizedProps(props));
}

export function trackAnalyticsOnce(eventName, dedupeKey = "", props = {}) {
  const key = `${eventName}:${dedupeKey}`;
  if (!dedupeKey || onceKeys.has(key)) return false;
  onceKeys.add(key);
  trackAnalytics(eventName, props);
  return true;
}

export function startAnalyticsTimer(timerId) {
  if (!timerId) return;
  timers.set(timerId, Date.now());
}

export function stopAnalyticsTimer(timerId) {
  if (!timerId) return 0;
  const started = timers.get(timerId);
  timers.delete(timerId);
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Date.now() - started);
}
