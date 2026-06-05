export const leadCaptureConfig = {
  provider: "formspree",
  formName: "pinball-scout-help",
  endpoint: "https://formspree.io/f/xwvraylz",
  successMessage: "Thanks. Your request is in and we’ll use it to help narrow the right machine.",
  errorMessage: "Your request did not go through. Please try again in a moment or email support directly."
};

export const pinballMapConfig = {
  siteBaseUrl: "https://pinballmap.com",
  zipLookupBaseUrl: "https://api.zippopotam.us/us",
  locationSearchLimit: 40,
  machineDetailLimit: 12,
  radialSampleCount: 12
};
