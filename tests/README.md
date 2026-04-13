# Persona Testing

This Playwright layer is for pre-user-testing validation of Pinball Scout as a guided buyer-decision product, not just a click-through site.

## Structure

- `tests/personas/` test specs that define persona journeys
- `tests/fixtures/personas.js` deterministic persona definitions and behavior rules
- `tests/flows/persona-flows.js` reusable step-level journey actions
- `tests/helpers/locators.js` scoped UI locators for brittle or repeated action surfaces
- `tests/helpers/persona-runner.js` scenario wrapper with failure capture
- `tests/helpers/scenario-outcome.js` JSON outcome logging
- `tests/helpers/static-server.mjs` local static server used by Playwright

## Current Personas

- `The Overwhelmed Novice`
- `The Practical / Low-Regret Buyer`
- `The Theme-Driven Buyer`

## Current Coverage

- entry and discovery start
- context and taste-profile completion
- machine reaction loop through shortlist
- shortlist to compare and shortlist to buying plan
- front-runner selection
- required checks / readiness path
- Decision Brief creation
- resume / re-entry checks

## Extend It

1. Add a persona object in `tests/fixtures/personas.js`.
2. Reuse existing flow steps from `tests/flows/persona-flows.js` where possible.
3. Add new scoped locators in `tests/helpers/locators.js` if a UI action appears in more than one place.
4. Create a new test in `tests/personas/persona-journeys.spec.js` or split into another spec when the journey meaningfully differs.

## Outcome Logs

Each run writes JSON into `test-results/persona-outcomes/` with:

- persona identity
- path taken
- end URL
- whether shortlist / compare / front-runner / plan / brief / resume were reached
- confusion flags
- dead-end states
- final status and error text

## Assumptions

- Persona tests stay deterministic.
- Tests prefer explicit `data-*` hooks and scoped containers over text-only selectors.
- These tests validate guided flow clarity and continuity, but they do not replace exploratory UX review with real users.
