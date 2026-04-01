import { discoveryMachines } from "../data/discovery-machines.js";
import { attachImageFallbacks, renderMachineImage, renderSplitCard, updateCompareCount } from "./utils.js";
import { initNav } from "./nav.js";
import { clearDecisionState, loadDecisionState } from "./decision-state.js";
import { buildDecisionContinuityModel, initDecisionBar } from "./decision-bar.js";
import { ANALYTICS_EVENTS, deriveSessionMode, trackAnalytics } from "./analytics-events.js";

const featured = discoveryMachines.slice(0, 3);
const root = document.querySelector("#starter-preview-grid");
const DISCOVERY_STATE_KEY = "pinballScoutDiscoveryStateV2";

function previewCard(machine) {
  return renderSplitCard({
    className: "starter-preview-card",
    mediaClassName: "starter-preview-card__media",
    imageHtml: renderMachineImage(machine, { className: "machine-image-frame--thumb split-card__image starter-preview-card__image" }),
    bodyHtml: `
      <p class="eyebrow">Starter machine</p>
      <h3>${machine.name}</h3>
      <p class="muted">${machine.shortDescription}</p>
      <p class="fit-summary"><strong>Why beginners shortlist it:</strong> ${machine.starterRecommendationReason}</p>
      <a class="text-link" href="machine.html?slug=${machine.slug}">See machine detail</a>
    `
  });
}

if (root) {
  root.innerHTML = featured.map((machine) => previewCard(machine)).join("");
  attachImageFallbacks(root);
}

initNav();
updateCompareCount();

document.querySelectorAll('main a.btn[href="help.html"]').forEach((link) => {
  if (link.dataset.analyticsBound === "true") return;
  link.dataset.analyticsBound = "true";
  link.addEventListener("click", () => {
    trackAnalytics(ANALYTICS_EVENTS.START_DISCOVERY_CLICKED, {
      source: "homepage_primary",
      session_mode: deriveSessionMode(loadDecisionState())
    });
  });
});

window.addEventListener("compare-updated", () => {
  updateCompareCount();
});

function formatSavedSessionTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function initResumeBanner() {
  const banner = document.querySelector("#homepage-resume-banner");
  const copy = document.querySelector("#homepage-resume-copy");
  const resumeLink = document.querySelector("#homepage-resume-link");
  const dismiss = document.querySelector("#homepage-resume-dismiss");
  if (!banner || !copy || !resumeLink || !dismiss) return;

  let saved = loadDecisionState();
  if (!saved?.hasLegacyDiscovery && !saved?.frontRunnerSlug && !(saved?.backupSlugs || []).length) {
    try {
      saved = JSON.parse(localStorage.getItem(DISCOVERY_STATE_KEY) || "null");
    } catch {
      saved = null;
    }
  }
  if (!saved) return;

  const decisionState = loadDecisionState();
  const model = buildDecisionContinuityModel(decisionState, { page: "home", screen: "home" });
  const savedLabel = formatSavedSessionTimestamp(decisionState.updatedAt || saved.updatedAt);

  if (model.temporaryPrimary && model.frontInfo) {
    banner.querySelector(".eyebrow").textContent = "Temporary front-runner";
    banner.querySelector("h2").textContent = "You have a temporary front-runner";
    copy.textContent = `${model.frontInfo.machine.name} is your current temporary pick while one tie-breaker remains.`;
    resumeLink.textContent = "Resume tie-breaker";
    resumeLink.href = "compare.html";
    dismiss.textContent = "Review both machines";
    dismiss.dataset.mode = "review-both";
  } else if (model.backupMoreReady && model.topBackup) {
    banner.querySelector(".eyebrow").textContent = "Decision alert";
    banner.querySelector("h2").textContent = `${model.topBackup.machine.name} is currently more ready`;
    copy.textContent = `Your current front-runner is less ready right now. Compare both options and decide whether to promote the backup.`;
    resumeLink.textContent = "Review both machines";
    resumeLink.href = "compare.html";
    dismiss.textContent = "Keep current plan";
    dismiss.dataset.mode = "keep";
  } else {
    banner.querySelector(".eyebrow").textContent = "Saved session";
    banner.querySelector("h2").textContent = "Pick up where you left off";
    copy.textContent = savedLabel
      ? `You already have a saved first-pin session from ${savedLabel}.`
      : "You already have a saved first-pin session ready to resume.";
    resumeLink.textContent = "Resume discovery";
    resumeLink.href = "help.html?resume=1";
    dismiss.textContent = "Start fresh";
    dismiss.dataset.mode = "reset";
  }
  banner.hidden = false;

  resumeLink.addEventListener("click", () => {
    if (decisionState.temporaryPrimary) {
      trackAnalytics(ANALYTICS_EVENTS.TEMPORARY_PRIMARY_RESUMED, { machine_slug: decisionState.frontRunnerSlug || "", screen: "home" });
    }
    trackAnalytics(ANALYTICS_EVENTS.RESUME_BANNER_CLICKED, {
      state_type: decisionState.temporaryPrimary ? "temporary_primary" : model.backupMoreReady ? "backup_more_ready" : "saved_session",
      screen: "home"
    });
  });

  dismiss.addEventListener("click", () => {
    if (dismiss.dataset.mode === "review-both") {
      trackAnalytics(ANALYTICS_EVENTS.TEMPORARY_PRIMARY_RESUMED, { machine_slug: decisionState.frontRunnerSlug || "", screen: "home" });
      trackAnalytics(ANALYTICS_EVENTS.RESUME_BANNER_CLICKED, {
        state_type: "temporary_primary",
        screen: "home"
      });
      window.location.href = "compare.html";
      return;
    }
    if (dismiss.dataset.mode === "keep") {
      banner.hidden = true;
      return;
    }
    localStorage.removeItem(DISCOVERY_STATE_KEY);
    clearDecisionState();
    banner.hidden = true;
    trackAnalytics("discard_saved_session", { source: "homepage-banner" });
  });
}

initResumeBanner();

initDecisionBar({
  page: "home",
  getViewState: () => ({ screen: "home" })
});
