Machine media pipeline files:

- `machine-media.generated.js`: checked-in normalized media records used by the UI
- `machine-media-overrides.json`: manual overrides, applied before adapter matching
- `machine-media-unresolved.generated.json`: review queue for unresolved machines

Manual override shape:

```json
[
  {
    "machineSlug": "godzilla-pro",
    "forcedPrimaryImageUrl": "assets/machines/godzilla_pro.png",
    "forcedSource": "MANUAL",
    "notes": "Use the cabinet shot instead of the default import."
  }
]
```

Rebuild commands:

- `npm run media:import`
- `npm run media:unresolved`
