# Pinball Scout MVP - Vanilla HTML/CSS/JS

A lean, dependency-free MVP for the buyer journey of Pinball Scout.

## What is included

- Homepage
- Searchable, filterable machine directory with URL-backed state
- Machine detail pages
- Compare 2-3 machines using localStorage
- Buyer help form wired for real submission providers
- Lightweight analytics hooks via `trackEvent()`
- Simple real-image support with graceful fallback
- Seeded machine data in a simple JavaScript file

## Why this version

This version avoids npm packages and frameworks so it is:

- easier to run
- easier to inspect
- easier for AI to extend
- lower dependency surface

## How to run

### Easiest option
Open `index.html` directly in your browser.

### Better option for module loading
Use a tiny local web server.

If Python is installed:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Persona-based Playwright testing

This repo now includes deterministic persona E2E journeys for pre-user-testing validation.

### What is included

- Playwright config with built-in local static server
- Persona fixtures for beginner buyer archetypes
- Reusable flow helpers for discovery, shortlist, compare, sourcing, and resume
- Scenario outcome JSON logs for each persona run

### Persona tests currently implemented

- Overwhelmed Novice
- Practical / Low-Regret Buyer
- Theme-Driven Buyer

### Install test dependencies

```bash
npm install
npx playwright install chromium
```

### Run persona tests

```bash
npm run test:personas
```

Headed mode:

```bash
npm run test:personas:headed
```

Interactive UI mode:

```bash
npm run test:personas:ui
```

Open the HTML report:

```bash
npm run test:personas:report
```

### Outcome logs

After runs, persona outcome JSON files are written to:

`test-results/persona-outcomes/`

Each file includes:

- persona name/id
- path taken
- end location
- shortlist/compare/front-runner/plan/brief/re-entry flags
- confusion flags and dead-end states

## Files

- `data/machines.js` - seeded machine records
- `data/market-pricing-sources.js` - source mapping for monthly market pricing imports
- `data/market-pricing.generated.js` - generated monthly market pricing cache
- `lib/` - page logic and shared utilities
- `styles.css` - app styling
- `index.html` - homepage
- `machines.html` - directory
- `machine.html` - detail page
- `compare.html` - compare page
- `help.html` - lead form

## Lead capture setup

Lead capture is configured in `lib/config.js`.

- Current default provider: Formspree
- Replace `https://formspree.io/f/REPLACE_WITH_YOUR_FORM_ID` in `lib/config.js` with your real Formspree endpoint
- Netlify remains supported if you switch `provider` back to `netlify` and deploy the site on Netlify

The submission helper lives in `lib/lead-capture.js` so the provider can be swapped later without rewriting the page.

## Image setup

Add machine images to `assets/machines/` using each machine slug as the filename, for example `godzilla-pro.jpg`.

## Market pricing import

Monthly used-price guidance can be imported into a generated local cache:

```bash
npm run pricing:import
```

The importer uses this hierarchy:

- `Pinball Prices` as the primary recent-sales source
- `Pinside` machine and market pages as fallback validation
- `data/market-pricing-overrides.json` for manual fixes on thin or ambiguous titles

Generated output is written to `data/market-pricing.generated.js`.
