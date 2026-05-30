export function resultsNextStep(page) {
  return page.locator(".results-next-step");
}

export function resultsMoreActionsPanel(page) {
  return page.locator(".more-actions-panel");
}

export function resultsCompareLink(page) {
  return resultsMoreActionsPanel(page).locator(".card-actions a[href='compare.html']");
}

export function buyPathStep(page) {
  return page.locator("#plan-path-step");
}

export function buyPathOption(page, pathType) {
  return buyPathStep(page).locator(`[data-action='plan-set-path:${pathType}']`);
}

export function compareDecisionGrid(page) {
  return page.locator(".compare-decision-grid");
}

export function frontRunnerChoice(page) {
  return compareDecisionGrid(page).locator("[data-action^='choose-front-runner:']").first();
}
