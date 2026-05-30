# Play-First Discovery — Feature Spec

## Problem

The current discovery flow shows video previews of machines the user has never touched. That signal carries 1.0× weight in the recommendation engine. A real-play reaction at an arcade carries 1.5–2.5× weight — the same number of answers, but orders of magnitude more useful.

A large portion of beginners already have access to machines at arcades, barcades, bowling alleys, or a friend's basement. This feature surfaces that option early and lets them use it.

---

## Goal

Allow users who can access pinball machines nearby to log real-play experience before (or instead of) watching video previews. Real-play reactions bootstrap a much stronger taste profile with fewer total inputs.

---

## Flow Overview

```
[discovery-setup]
  budget + condition
       |
       ▼
 [zip-prompt]  ──── skip ────────────────────────────┐
       |                                              |
   ZIP entered                                        |
       |                                              |
       ▼                                              |
  API call to findNearbyLocations()                   |
       |                                              |
  Machines found?                                     |
    /         \                                       |
  YES          NO (or error)                          |
   |              |                                   |
   ▼              ▼                                   |
[nearby-     "Nothing nearby" → skip ────────────────┤
 branch]                                              |
   |                                                  |
  Choice                                              |
   |  \                                               |
   |   skip ────────────────────────────────────────┤
   |                                                  |
   ▼                                                  ▼
[nearby-                                     [discovery-round]
 play-list]                                  video reactions
   |                                                  |
[post-play]                                           |
 × n (≥3)                                             |
   |                                                  |
   └──────────────────┬───────────────────────────────┘
                      ▼
               [taste-profile]
                      |
                      ▼
                  [results]
```

---

## New Screens

### `zip-prompt`

**When it appears:** Immediately after `discovery-setup` (the budget + condition screen), before any reactions.

**Heading:** Are there pinball machines near you?

**Body copy:** If you have access to an arcade, barcade, or venue, you can play machines first and log your real reactions. Real-play data produces much better recommendations than video previews.

**Inputs:**
- ZIP code field (5-digit US only, validated before API call)

**Actions:**
- `"Find machines near me"` → submit ZIP, show loading state, then either `nearby-branch` or error
- `"Skip — I'll just watch previews"` → goes to `discovery-round`

**Loading state:** "Looking for pinball near [ZIP]…" with a spinner. Timeout after 8 seconds → error state.

**Error state:** "Couldn't reach the machine locator right now." with "Try again" and "Skip to video previews" CTAs.

---

### `nearby-branch`

**When it appears:** After ZIP lookup returns ≥1 location with ≥1 catalog-matched machine.

**"Nothing found" variant:** When ZIP lookup returns locations but zero catalog-matched machines. Show: "We found [N] venues near you, but none of their machines are in our catalog yet." → single CTA: "Continue to video previews."

**Heading:** Found [N] machines at [M] locations near you.

**Content:**
- Top 3 locations listed: name, city, distance in miles, machine count badge
- If >3 locations: "and [X] more venues"
- Catalog match count: "[N] of those machines are in our guide — enough to build a real taste profile."

**Actions:**
- `"Play these first"` (primary) → `nearby-play-list`
- `"Skip — show me video previews"` (secondary) → `discovery-round`

---

### `nearby-play-list`

**When it appears:** After user chooses "Play these first."

**Heading:** Go play a few — then come back.

**Subtext:** Log each machine you play. After 3, we can build your shortlist.

**Content:**
- Grouped by location (location name + distance as section header)
- Each machine card:
  - Machine name
  - "Log this play" button → sets `state.currentProbeId` and navigates to `post-play`
  - After logged: replaced with a "✓ Played" badge (disabled state)
- Non-catalog machines (Pinball Map names with no catalog match):
  - Shown greyed out
  - Label: "Not in our guide yet"
  - No "Log this play" button
- Progress indicator: "[N] of 3 minimum logged"
- `"Done — build my shortlist"` button:
  - Disabled until `state.playedInPersonCount >= 3`
  - When disabled: "Log [X] more to continue"
  - When enabled: "Done — show my recommendations (based on [N] plays)"
  - Action → `taste-profile`

---

## State Changes

New fields to add to the session state:

```js
// Set when ZIP is submitted and API call succeeds
state.nearbyLocations = null;        // Array<Location> from findNearbyLocations, or null

// true when user chose "Play these first" (vs. video path)
state.nearbyPlaySession = false;

// Count of submitted post-play feedbacks on the play-first path
state.playedInPersonCount = 0;

// Map<machineId, Location[]> — which locations have each catalog machine
state.nearbyMachineIndex = null;
```

Existing fields reused without modification:
- `state.screen` — new values: `"zip-prompt"`, `"nearby-branch"`, `"nearby-play-list"`
- `state.reactions` — real-play reactions pushed here alongside video reactions
- `state.currentProbeId` — already drives `renderPostPlayFeedback`; reused unchanged

---

## Probe Shape

When building a probe from a nearby machine (not from `buildTasteProbeSuggestions`):

```js
{
  machineId: catalogMachine.id,
  targetIds: [catalogMachine.id],
  probeType: "nearby",             // weight: 1.5×
  reason: `Available at ${location.name}`,
  reveals: "Your real reaction carries more weight than a video preview",
  machine: catalogMachine,
  locationMatches: [location]
}
```

If a machine appears on both the nearby list AND is later recommended (shortlist), it stays at "nearby" type — the weight upgrade to "exact" (2.5×) only applies to post-shortlist probing (the existing calibration flow), not to pre-shortlist plays.

---

## Matching Logic

`findNearbyLocations` returns `machineNames: string[]` — raw strings from Pinball Map.
These need to match against catalog machine names.

**Normalizer:** `s.toLowerCase().replace(/[^a-z0-9]/g, '')`

**Match tiers:**
| Match | probeType | Example |
|-------|-----------|---------|
| Normalized strings are identical | `"nearby"` | "Godzilla Pro" ↔ "Godzilla Pro" |
| Catalog name contained in Pinball Map name, or vice versa | `"nearby"` | "Godzilla" ↔ "Godzilla Premium" |
| No match | excluded from catalog list | "Monster Bash (Remake)" with no catalog entry |

Note: All play-first probes use `"nearby"` type (1.5× weight). The "exact" and "proxy" distinctions are reserved for the post-shortlist calibration probe flow and should not be used here.

---

## Reaction Weight Summary

| Source | Weight | When used |
|--------|--------|-----------|
| Video preview (discovery) | 1.0× | Current default path |
| Real-play nearby (play-first) | 1.5× | New path — machine at nearby venue |
| Real-play proxy (calibration) | 1.8× | Existing — post-shortlist probe, proxy machine |
| Real-play exact (calibration) | 2.5× | Existing — post-shortlist probe, exact machine |

---

## Minimum Viable Plays

- Minimum to enable "Done": **3 post-play feedbacks**
- No hard maximum — user can log as many as they want
- After 3: "Done — build my shortlist" CTA enables
- After 6+: add a soft nudge ("You've played a lot — your shortlist will be sharp")
- Edge: user logs 3+ but then wants to also watch videos — not supported in this flow; they chose the play-first path

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| ZIP returns no locations within 50mi | "No venues found near [ZIP]. Try a different ZIP or skip to video previews." |
| Locations found but no catalog matches | Show venue names, explain gap, single CTA to video previews |
| API error or 8s timeout | Error message + "Try again" + "Skip to video previews" |
| User plays <3 machines and wants to stop | "Done" button stays disabled; copy shows how many more needed |
| Same machine logged twice | Allow it — reactions are additive; second play pushes a second reaction object |
| Machine at multiple locations | Show under the nearest location; `locationMatches` includes all of them |
| Non-US ZIP or invalid format | Client-side validation, inline error before API call |

---

## Analytics Events

| Event | Fired when | Props |
|-------|------------|-------|
| `play_first_offered` | `zip-prompt` screen renders | `source: "help_entry_discovery"` |
| `play_first_zip_submitted` | User submits ZIP | `zip, has_locations, location_count, catalog_machine_count` |
| `play_first_selected` | "Play these first" tapped | `location_count, catalog_machine_count` |
| `play_first_skipped` | Skip tapped at either decision point | `screen: "zip-prompt" \| "nearby-branch"` |
| `in_person_play_logged` | `submitPostPlayFeedback` on play-first path | `machine_id, enjoyment, replay, session_play_count` |
| `play_first_complete` | "Done — build my shortlist" tapped | `machines_played, locations_visited` |

---

## Files to Modify

| File | What changes |
|------|--------------|
| `lib/help-page.js` | Add `renderZipPrompt()`, `renderNearbyBranch()`, `renderNearbyPlayList()` |
| `lib/help-page.js` | Redirect `start-discovery` action → `"zip-prompt"` instead of directly to `beginReactions()` |
| `lib/help-page.js` | Add action handlers: `submit-zip`, `play-these-first`, `skip-to-video`, `log-this-play` |
| `lib/help-page.js` | Add new state fields to session init and `defaultState()` |
| `lib/help-page.js` | Extend main `render()` switch to handle 3 new screen values |

No new files required. No changes to `lib/discovery-engine.js`, `lib/pinball-map.js`, or data files — all infrastructure already exists.

---

## Out of Scope

- Saving favorite venues across sessions
- Native geolocation (GPS) — ZIP input only
- Directions or mapping UI
- Adding non-catalog machines to the guide
- Social features ("your friend played X")
- "Come back later" / async multi-session play logging
- Play-first path for the calibration flow (calibration starts post-shortlist; this is pre-shortlist only)
- International locations or non-US ZIPs
