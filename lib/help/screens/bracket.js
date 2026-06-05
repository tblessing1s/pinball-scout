import { state } from "../state.js";
import { BRACKET_FACTORS } from "../../../data/bracket-config.js";
import { discoveryMachineIndex } from "../../../data/discovery-machines.js";
import { machineDisplayTitle, renderMachineImage } from "../../utils.js";
import { buildPlayerArchetype } from "./taste.js";

export function bracketCurrentPair() {
  const { bracketRound: round, bracketMatchIndex: mi, bracketSeeds: seeds, bracketWinners: winners } = state;
  if (round === 0) return [seeds[mi * 2], seeds[mi * 2 + 1]];
  const prev = winners[round - 1] || [];
  return [prev[mi * 2], prev[mi * 2 + 1]];
}

export function bracketMatchCount(round) {
  return Math.max(1, Math.floor(state.bracketSeeds.length / Math.pow(2, round + 1)));
}

export function bracketRoundLabel(round) {
  const maxRounds = state.bracketWinners.length;
  if (maxRounds >= 3) return (["Quarter-final", "Semi-final", "Final"])[round] ?? "Final";
  if (maxRounds === 2) return (["Semi-final", "Final"])[round] ?? "Final";
  return "Final";
}

export function renderBracketPips(wins) {
  return Array.from({ length: 3 }, (_, i) => `<span class="bracket-pip${i < wins ? " is-filled" : ""}"></span>`).join("");
}

export function renderBracketStatus() {
  const { bracketSeeds: seeds, bracketRound, bracketMatchIndex, bracketWinners, bracketMatchWon } = state;
  const roundCount = bracketWinners.length;
  const abbrevs = roundCount >= 3 ? ["QF", "SF", "F"] : roundCount === 2 ? ["SF", "F"] : ["F"];

  return `
    <div class="bracket-status">
      ${abbrevs.map((abbrev, rIdx) => {
        const count = bracketMatchCount(rIdx);
        const roundWinners = bracketWinners[rIdx] || [];
        const rows = Array.from({ length: count }, (_, i) => {
          let leftId, rightId;
          if (rIdx === 0) { leftId = seeds[i * 2]; rightId = seeds[i * 2 + 1]; }
          else { const prev = bracketWinners[rIdx - 1] || []; leftId = prev[i * 2]; rightId = prev[i * 2 + 1]; }
          const winnerId = roundWinners[i];
          const isCurrent = rIdx === bracketRound && i === bracketMatchIndex && !bracketMatchWon;
          const leftName = leftId ? (discoveryMachineIndex.get(leftId)?.name ?? "?") : "TBD";
          const rightName = rightId ? (discoveryMachineIndex.get(rightId)?.name ?? "?") : "TBD";
          const winnerName = winnerId ? (discoveryMachineIndex.get(winnerId)?.name ?? "?") : "";
          return `<div class="bracket-match-row${isCurrent ? " is-current" : ""}${winnerId ? " is-done" : ""}">
            ${winnerId
              ? `<span class="bm-winner">✓ ${winnerName}</span>`
              : `<span class="bm-pair">${leftName} <span class="bm-vs">vs</span> ${rightName}</span>`
            }
          </div>`;
        });
        return `<div class="bracket-round-group">
          <span class="bracket-group-label">${abbrev}</span>
          <div class="bracket-group-matches">${rows.join("")}</div>
        </div>`;
      }).join("")}
    </div>
  `;
}

export function getBracketFinalThree() {
  const w = state.bracketWinners;
  const champion = w[2]?.[0] || w[1]?.[0] || "";
  const sfWinners = w[1] || [];
  const runnerUp = sfWinners.find((id) => id !== champion) || "";
  const sfWinnerSet = new Set(sfWinners);
  const sfLosers = (w[0] || []).filter((id) => !sfWinnerSet.has(id));
  const third = sfLosers[0] || "";
  return [champion, runnerUp, third].filter(Boolean);
}

export function renderBracket(buildMachineArchetypeReason) {
  const { bracketRound: round, bracketMatchIndex: mi, bracketFactor, bracketLeftWins, bracketRightWins, bracketMatchWon, bracketMatchScore, bracketWinners } = state;
  const archetype = buildPlayerArchetype(state.tasteScores);
  const matchCount = bracketMatchCount(round);
  const roundLabel = bracketRoundLabel(round);
  const isFinal = round === bracketWinners.length - 1;

  if (bracketMatchWon) {
    const winner = discoveryMachineIndex.get(bracketMatchWon);
    const isChampion = isFinal && (bracketWinners[round]?.length ?? 0) === matchCount;
    return `
      <section class="discovery-shell">
        <div class="bracket-winner-screen panel${isChampion ? " is-champion" : ""}">
          ${renderMachineImage(winner, { eager: true, className: "machine-image-frame--thumb bracket-winner-img" })}
          <div class="bracket-winner-label">
            <p class="eyebrow">${isChampion ? "Your #1 machine" : "Advances!"}</p>
            <h2 class="bracket-winner-name">${isChampion ? "🏆 " : ""}${machineDisplayTitle(winner)}</h2>
            ${isChampion
              ? `<p>${buildMachineArchetypeReason(winner, archetype, state.tasteScores)}</p>`
              : `<p class="muted">Won ${bracketMatchScore}</p>`
            }
          </div>
        </div>
        ${renderBracketStatus()}
        <div class="discovery-actions">
          ${isChampion
            ? `<button class="btn btn-primary" type="button" data-action="bracket-next-match">See what's near you →</button>`
            : `<button class="btn btn-primary" type="button" data-action="bracket-next-match">Next match →</button>`
          }
          <button class="btn btn-secondary small" type="button" data-action="back-to-profile">Back to profile</button>
        </div>
      </section>
    `;
  }

  const [leftId, rightId] = bracketCurrentPair();
  const leftMachine = leftId ? discoveryMachineIndex.get(leftId) : null;
  const rightMachine = rightId ? discoveryMachineIndex.get(rightId) : null;
  if (!leftMachine || !rightMachine) return "";

  const factor = BRACKET_FACTORS[bracketFactor] ?? BRACKET_FACTORS[0];

  const renderCard = (machine, wins) => `
    <article class="taste-pivot-card panel bracket-factor-card">
      ${renderMachineImage(machine, { eager: true, className: "machine-image-frame--thumb" })}
      <div class="taste-pivot-body">
        <h3>${machineDisplayTitle(machine)}</h3>
        ${factor.getDetail(machine) ? `<p class="eyebrow bracket-card-eyebrow">${factor.getDetail(machine)}</p>` : ""}
        <p class="bracket-blurb">${factor.getBlurb(machine)}</p>
      </div>
      <div class="bracket-card-pips">${renderBracketPips(wins)}</div>
      <button class="btn btn-primary" type="button" data-action="bracket-pick:${machine.id}">Pick this</button>
    </article>
  `;

  return `
    <section class="discovery-shell">
      <div class="bracket-header panel">
        <div class="bracket-header-row">
          <span class="bracket-round-chip">${roundLabel} · Match ${mi + 1} of ${matchCount}</span>
          <span class="bracket-factor-chip">${factor.eyebrow} · Factor ${bracketFactor + 1} / 3</span>
        </div>
        <p class="bracket-question">${factor.question}</p>
        ${bracketFactor > 0 ? `<p class="bracket-lead-note muted">${
          bracketLeftWins > bracketRightWins
            ? `${machineDisplayTitle(leftMachine)} leads — pick to win or close the gap`
            : bracketRightWins > bracketLeftWins
            ? `${machineDisplayTitle(rightMachine)} leads — pick to win or close the gap`
            : "Tied — this pick decides who takes the lead"
        }</p>` : ""}
      </div>
      <div class="taste-pivot-grid">
        ${renderCard(leftMachine, bracketLeftWins)}
        <div class="taste-pivot-or"><span>vs</span></div>
        ${renderCard(rightMachine, bracketRightWins)}
      </div>
      <details class="bracket-status-details">
        <summary>Full bracket</summary>
        ${renderBracketStatus()}
      </details>
    </section>
  `;
}

export function renderBracketNearby(buildMachineArchetypeReason) {
  const finalThree = getBracketFinalThree();
  const champion = finalThree[0] ? discoveryMachineIndex.get(finalThree[0]) : null;
  const runnerUp = finalThree[1] ? discoveryMachineIndex.get(finalThree[1]) : null;
  const third = finalThree[2] ? discoveryMachineIndex.get(finalThree[2]) : null;
  const archetype = buildPlayerArchetype(state.tasteScores);
  const formatPrice = (m) => m?.estimated_price_min && m?.estimated_price_max
    ? `$${m.estimated_price_min.toLocaleString()} – $${m.estimated_price_max.toLocaleString()}`
    : "";

  const MEDALS = { 1: { emoji: "🥇", label: "Gold", cls: "gold" }, 2: { emoji: "🥈", label: "Silver", cls: "silver" }, 3: { emoji: "🥉", label: "Bronze", cls: "bronze" } };

  const renderPodiumCard = (machine, rank) => {
    if (!machine) return "";
    const medal = MEDALS[rank];
    const isPlayed = state.selectedPlayedMachines.includes(machine.id);
    const isOwned = state.ownedMachines.includes(machine.id);
    return `
      <article class="panel bracket-podium-card bracket-podium-card--${medal.cls}">
        <div class="bracket-podium-medal">${medal.emoji} <span>${medal.label}</span></div>
        ${renderMachineImage(machine, { eager: rank === 1, className: "machine-image-frame--thumb" })}
        <div class="bracket-podium-body">
          <h3>${machineDisplayTitle(machine)}</h3>
          <p class="bracket-podium-reason">${buildMachineArchetypeReason(machine, archetype, state.tasteScores)}</p>
          ${formatPrice(machine) ? `<p class="bracket-podium-price">${formatPrice(machine)}</p>` : ""}
          ${isPlayed || isOwned ? `<div class="badge-row" style="margin-top:.35rem">
            ${isPlayed ? `<span class="played-badge">Played</span>` : ""}
            ${isOwned ? `<span class="owned-badge">Owned</span>` : ""}
          </div>` : ""}
        </div>
      </article>`;
  };

  const championName = champion ? machineDisplayTitle(champion) : "your top pick";

  return `
    <section class="discovery-shell">
      <div class="bracket-podium-header">
        <p class="eyebrow">Bracket complete</p>
        <h2>Your #1 pick is ${championName}</h2>
        <p class="muted">Based on your taste profile, here's how the machines ranked.</p>
      </div>
      <div class="bracket-podium">
        ${renderPodiumCard(champion, 1)}
        ${runnerUp || third ? `
          <div class="bracket-podium-row">
            ${renderPodiumCard(runnerUp, 2)}
            ${renderPodiumCard(third, 3)}
          </div>` : ""}
      </div>
      <article class="panel results-next-step">
        <p class="eyebrow">Before you buy</p>
        <h3>Try ${championName} before you commit</h3>
        <p class="muted">Playing it — or something with a similar feel — in person is the fastest way to confirm you've got the right machine. We'll use Pinball Map to find locations near you.</p>
        <div class="card-actions">
          <button class="btn btn-primary" type="button" data-action="open-nearby">Find machines to test nearby</button>
          <button class="btn btn-secondary" type="button" data-action="bracket-nearby-buy">Skip — start buying plan</button>
        </div>
      </article>
      <button class="btn btn-secondary small" type="button" data-action="back-to-profile">Back to taste profile</button>
    </section>`;
}

export function renderBracketTestGroup(targetMachine, rankIndex, allSuggestions, rankedProxyTraitChecks) {
  const BRACKET_RANK_LABELS = [
    { medal: "🥇", rank: "Gold · Your #1 pick", priority: "Highest priority — try to play this one first." },
    { medal: "🥈", rank: "Silver · Runner-up", priority: "Try this if your #1 isn't available nearby." },
    { medal: "🥉", rank: "Bronze · Third place", priority: "Good fallback if the top two aren't close." }
  ];
  const meta = BRACKET_RANK_LABELS[rankIndex] || BRACKET_RANK_LABELS[2];
  const allProbes = allSuggestions.filter((s) => s.targetIds.includes(targetMachine.id));
  const hasExactWithLocation = allProbes.some((s) => s.probeType === "exact" && s.locationMatches.length > 0);
  const probes = hasExactWithLocation
    ? allProbes.filter((s) => s.probeType === "exact" && s.locationMatches.length > 0)
    : allProbes.filter((s) => s.locationMatches.length > 0);
  const focusChecks = rankedProxyTraitChecks(targetMachine, 3).map((item) => item.prompt);

  const renderProbeRow = (suggestion) => {
    const nearest = suggestion.locationMatches[0];
    const distLabel = nearest ? `${nearest.distanceMiles} mi · ${nearest.name}` : "No location found";
    const typeLabel = suggestion.probeType === "exact" ? "Exact match"
      : suggestion.probeType === "component-proxy" ? "Best available proxy"
      : "Proxy";
    const alreadyPlayed = (state.reactions || []).some(
      (r) => r.machineId === suggestion.machineId && String(r.source || "").startsWith("real-play")
    );
    return `
      <div class="bracket-probe-row${alreadyPlayed ? " is-played" : ""}">
        ${renderMachineImage(suggestion.machine, { className: "machine-image-frame--thumb bracket-probe-thumb" })}
        <div class="bracket-probe-body">
          <div class="bracket-probe-header">
            <strong>${machineDisplayTitle(suggestion.machine)}</strong>
            <span class="badge">${typeLabel}</span>
          </div>
          <p class="muted">${distLabel}</p>
          ${suggestion.probeType === "proxy" ? `<p class="bracket-probe-hint">When playing this, notice: ${focusChecks[0] || "how the game feel compares to what you want to own"}</p>` : ""}
        </div>
        <div class="bracket-probe-action">
          ${alreadyPlayed
            ? `<span class="played-badge">Played ✓</span>`
            : `<button class="btn btn-primary small" type="button" data-action="log-play:${suggestion.machineId}">I played this</button>`
          }
        </div>
      </div>
    `;
  };

  return `
    <div class="bracket-test-group panel">
      <div class="bracket-test-group__header">
        <span class="bracket-test-group__medal">${meta.medal}</span>
        <div>
          <p class="eyebrow">${meta.rank}</p>
          <h3>${machineDisplayTitle(targetMachine)}</h3>
          ${focusChecks.length ? `
            <p class="muted"><strong>What to focus on when testing:</strong> ${focusChecks.join(" · ")}</p>
          ` : ""}
        </div>
      </div>
      ${probes.length ? `
        <div class="bracket-probe-list">
          ${probes.map((s) => renderProbeRow(s)).join("")}
        </div>
      ` : `
        <p class="bracket-probe-empty muted">${state.locationSearch.hasSearched
          ? "No nearby matches found for this machine within your radius. Try a larger search distance, or log a game you've already played."
          : "Search your ZIP above to find places nearby where you can play this."
        }</p>
      `}
    </div>
  `;
}
