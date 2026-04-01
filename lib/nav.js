import { hasDecisionContext, loadDecisionState, sessionMode } from "./decision-state.js";
import { ANALYTICS_EVENTS, deriveScreen, trackAnalytics } from "./analytics-events.js";

const COMPARE_STATE_KEY = "pinballScoutCompare";

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function compareCount() {
  const parsed = safeJsonParse(localStorage.getItem(COMPARE_STATE_KEY) || "[]", []);
  return Array.isArray(parsed) ? parsed.length : 0;
}

function currentPage() {
  const path = window.location.pathname || "";
  if (path.endsWith("help.html")) return "help";
  if (path.endsWith("machines.html")) return "machines";
  if (path.endsWith("compare.html")) return "compare";
  if (path.endsWith("glossary.html")) return "glossary";
  if (path.endsWith("machine.html")) return "machine";
  return "index";
}

function buildNavHtml() {
  const page = currentPage();
  const state = loadDecisionState();
  const storedCompareCount = compareCount();
  const contextualCompareCount = state.frontRunnerSlug ? (1 + state.backupSlugs.length) : state.backupSlugs.length;
  const compare = Math.max(storedCompareCount, contextualCompareCount);
  const isReturning = sessionMode(state) === "returning";
  const showCompare = hasDecisionContext(state) || compare > 0 || page === "compare";
  const toolsOpen = page === "machines" || page === "glossary";

  const startLabel = isReturning ? "Continue Plan" : "Start";

  return `
    <a href="help.html" ${page === "help" ? 'aria-current="page"' : ""}>${startLabel}</a>
    ${isReturning ? `<a href="help.html?resume=1">My Progress</a>` : ""}
    ${showCompare ? `<a href="compare.html" ${page === "compare" ? 'aria-current="page"' : ""}>Compare Shortlist <span id="compare-count" class="count-pill">${compare}</span></a>` : ""}
    <details class="tools-menu"${toolsOpen ? " open" : ""}>
      <summary ${toolsOpen ? 'aria-current="page"' : ""}>Tools</summary>
      <div class="tools-menu__panel">
        <a href="machines.html?beginner=1&sort=beginner" ${page === "machines" ? 'aria-current="page"' : ""}>Best First Machines</a>
        <a href="glossary.html" ${page === "glossary" ? 'aria-current="page"' : ""}>Learn the Basics</a>
      </div>
    </details>
  `;
}

export function initNav() {
  const root = document.querySelector("[data-nav-root]");
  if (!root) return;
  const render = () => {
    root.innerHTML = buildNavHtml();
  };
  render();

  if (root.dataset.navBound === "true") return;
  root.dataset.navBound = "true";
  root.addEventListener("toggle", (event) => {
    const details = event.target.closest(".tools-menu");
    if (!details || !details.open) return;
    trackAnalytics(ANALYTICS_EVENTS.TOOLS_MENU_OPENED, {
      screen: deriveScreen(currentPage() === "index" ? "home" : currentPage()),
      session_mode: sessionMode(loadDecisionState())
    });
  });
  window.addEventListener("compare-updated", render);
  window.addEventListener("decision-state-updated", render);
}
