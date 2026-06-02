/**
 * Taste pivot pairs — the "this or that" comparison cards used to build
 * the player's preference profile before machine recommendations are shown.
 *
 * Each pair presents two machines that represent opposite poles on a taste
 * dimension. The scores for each side accumulate into the tasteScores object.
 */
export const TASTE_PIVOT_PAIRS = [
  {
    question: "When you sit down at a machine you've never played, what matters most?",
    left: {
      machineId: "deadpool-pro",
      details: [
        "Cracking up on your first ball — humor and clear targets click immediately",
        "Short, energetic games that make you want to hit start again right away"
      ],
      scores: { "learning-curve": -3, "pace-feel": -1, "replay": -2 }
    },
    right: {
      machineId: "jurassic-park-pro",
      details: [
        "Big story moments that unlock over time — always chasing the next dinosaur sequence",
        "The more games you play, the more the machine opens up and reveals"
      ],
      scores: { "learning-curve": 3, "challenge": 1, "replay": 2 }
    }
  },
  {
    question: "When you describe your machine to someone, what do you lead with?",
    left: {
      machineId: "iron-maiden-pro",
      details: [
        "Tight, fast layout built around nailing a set of precise, satisfying shots",
        "Pure shooting feel — you get better at it, not just more familiar with it"
      ],
      scores: { "theme-pull": -3, "challenge": 2, "pace-feel": -1 }
    },
    right: {
      machineId: "stranger-things-pro",
      details: [
        "You're literally inside the show — Demogorgons, the Mind Flayer, and Eleven",
        "Any guest can walk up and immediately feel what they're supposed to do"
      ],
      scores: { "theme-pull": 3, "ownership": -1 }
    }
  },
  {
    question: "After a great game, which feeling are you chasing next time?",
    left: {
      machineId: "attack-from-mars-remake",
      details: [
        "Every game is satisfying on its own — great time in 5 minutes, no buildup needed",
        "Works for the whole family and any guest, first visit or fiftieth"
      ],
      scores: { "challenge": -2, "replay": -3, "ownership": -2 }
    },
    right: {
      machineId: "godzilla-pro",
      details: [
        "Deep modes and big multiball sequences that reward you for learning the rules",
        "Still discovering new strategies and goals months after you bring it home"
      ],
      scores: { "learning-curve": 1, "replay": 3, "ownership": 2 }
    }
  },
  {
    question: "When you think about owning a machine for years, what keeps you coming back?",
    left: {
      machineId: "foo-fighters-pro",
      details: [
        "The personality and energy make every game feel good, even when you drain fast",
        "Easy to share with anyone — guests pick it up and enjoy it immediately"
      ],
      scores: { "learning-curve": -2, "pace-feel": -1, "ownership": -2, "theme-pull": 1 }
    },
    right: {
      machineId: "avengers-infinity-quest-pro",
      details: [
        "Dense rules and a high ceiling — still uncovering new strategies a year in",
        "The kind of machine you want to get better at, not just get familiar with"
      ],
      scores: { "learning-curve": 3, "challenge": 3, "replay": 2 }
    }
  },
  {
    question: "A friend who's never played pinball walks up — which reaction do you want?",
    left: {
      machineId: "mandalorian-pro",
      details: [
        "They recognize Mando immediately — the theme does all the selling before they even pull back the plunger",
        "Modern shot coaching and approachable rules mean they're scoring and smiling in 60 seconds"
      ],
      scores: { "theme-pull": 3, "learning-curve": -1, "ownership": -1 }
    },
    right: {
      machineId: "fish-tales",
      details: [
        "Pure instinct — hit the fish, everything makes sense from the first second",
        "Simple targets, fast games, and a big ramp make it addictive for anyone regardless of age or experience"
      ],
      scores: { "learning-curve": -3, "challenge": -2, "replay": -1 }
    }
  },
  {
    question: "Which machine would you still be happy to own in five years?",
    left: {
      machineId: "funhouse",
      details: [
        "Rudy watches your every move and reacts — the character IS the experience, not just the backdrop",
        "Playful and weird; every session feels fun even when your game completely falls apart"
      ],
      scores: { "theme-pull": 2, "ownership": -2, "challenge": -2 }
    },
    right: {
      machineId: "medieval-madness-remake",
      details: [
        "Smashing the castle and saucer never gets old — the shots themselves are the reward",
        "Enough strategy to stay interesting across hundreds of games without ever feeling overwhelming"
      ],
      scores: { "replay": 2, "ownership": 1, "challenge": 1 }
    }
  }
];
