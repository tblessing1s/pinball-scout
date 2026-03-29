import { leadCaptureConfig } from "./config.js";

function isNetlifyRuntime() {
  return window.location.hostname.endsWith(".netlify.app") || Boolean(window.Netlify);
}

function isLocalRuntime() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.protocol === "file:";
}

function providerError(message) {
  const error = new Error(message);
  error.name = "LeadCaptureConfigError";
  return error;
}

function encodeFormData(values) {
  return Object.entries(values)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export async function submitLead(values) {
  const config = leadCaptureConfig;

  if (config.provider === "netlify") {
    if (!isNetlifyRuntime()) {
      const localHint = isLocalRuntime()
        ? "Netlify Forms only works after the site is deployed on Netlify. For local testing, switch `lib/config.js` to Formspree and set a real Formspree endpoint."
        : "Netlify Forms requires this site to run on Netlify.";
      throw providerError(localHint);
    }

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encodeFormData(values)
    });

    if (!response.ok) throw new Error(`Netlify submission failed with ${response.status}`);
    return { ok: true };
  }

  if (config.provider === "formspree") {
    if (!config.endpoint || config.endpoint === "/" || config.endpoint.includes("REPLACE_WITH_YOUR_FORM_ID")) {
      throw providerError("Formspree is selected but `lib/config.js` still needs your real Formspree form URL.");
    }

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(values)
    });

    if (!response.ok) throw new Error(`Formspree submission failed with ${response.status}`);
    return { ok: true };
  }

  throw new Error(`Unsupported lead capture provider: ${config.provider}`);
}
