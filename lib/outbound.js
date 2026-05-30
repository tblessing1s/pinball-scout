import { trackEvent } from "./utils.js";

export function buildAffiliateUrl(url, context = {}) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "pinball-scout");
    u.searchParams.set("utm_medium", "referral");
    u.searchParams.set("utm_campaign", context.campaign ?? "buying-guide");
    if (context.machineSlug) u.searchParams.set("utm_content", context.machineSlug);
    if (context.placement) u.searchParams.set("utm_term", context.placement);
    return u.toString();
  } catch {
    return url;
  }
}

let _attached = false;
export function attachOutboundTracking() {
  if (_attached) return;
  _attached = true;
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-outbound-track]");
    if (!link) return;
    trackEvent("outbound_click", {
      url: link.href,
      label: link.dataset.outboundLabel ?? link.textContent.trim(),
      machine_slug: link.dataset.outboundSlug ?? "",
      placement: link.dataset.outboundPlacement ?? "",
    });
  });
}
