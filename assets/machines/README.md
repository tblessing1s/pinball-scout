Drop real machine images in this folder using the machine slug as the filename.

Supported filenames:
- `godzilla-pro.jpg`
- `godzilla-pro.jpeg`
- `godzilla-pro.png`
- `godzilla-pro.webp`

The app will try those extensions in that order and fall back to the existing text placeholder if no image is present.

The checked-in media pipeline also reads `assets/machines/manifest.json` as the local-cache fallback source for `data/machine-media.generated.js`.
