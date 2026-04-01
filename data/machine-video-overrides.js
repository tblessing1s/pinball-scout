import { indexBy } from "../lib/collection-utils.js";

export const machineVideoOverrides = [
  {
    machineSlug: "godzilla-pro",
    overviewUrl: "https://youtu.be/QoRu7ymNtuo",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  },
  {
    machineSlug: "deadpool-pro",
    overviewUrl: "https://youtu.be/zkHu6VpMF9k",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  },
  {
    machineSlug: "foo-fighters-pro",
    overviewUrl: "https://youtu.be/LYFt7-7AW2c",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  },
  {
    machineSlug: "avengers-infinity-quest-pro",
    overviewUrl: "https://youtu.be/5iJsjTcE8Xs",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  },
  {
    machineSlug: "jurassic-park-pro",
    overviewUrl: "https://youtu.be/0Onu1iGZWyg",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  },
  {
    machineSlug: "venom-pro",
    overviewUrl: "https://youtu.be/nmQyZvoilVM",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  },
  {
    machineSlug: "mandalorian-pro",
    overviewUrl: "https://youtu.be/_f08C9JHR3s",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  },
  {
    machineSlug: "iron-maiden-pro",
    overviewUrl: "https://youtu.be/5eCSJd9mUQo",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  },
  {
    machineSlug: "jaws-pro",
    overviewUrl: "https://youtu.be/x4l-kbTPALg",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  },
  {
    machineSlug: "stranger-things-pro",
    overviewUrl: "https://youtu.be/GtOwOb7V6zM",
    overviewLabel: "Official overview",
    overviewCreatorName: "Stern Pinball"
  }
];

export const machineVideoOverrideIndex = indexBy(machineVideoOverrides, "machineSlug");
