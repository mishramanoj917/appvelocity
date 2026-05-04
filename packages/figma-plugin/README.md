# AppVelocity Figma Plugin

Exports a Figma page as a ZIP for pixel-perfect code generation in AppVelocity.

## Build

```bash
cd packages/figma-plugin
npm install
npm run build
# → dist/plugin.js + dist/ui.html
```

## Install (Figma Desktop)

1. Open **Figma Desktop App** (not the browser)
2. Menu → **Plugins** → **Development** → **Import plugin from manifest...**
3. Select `packages/figma-plugin/manifest.json`
4. Plugin appears under **Plugins → Development → AppVelocity Exporter**

## Usage

1. Open a Figma file with your design
2. Run **Plugins → Development → AppVelocity Exporter**
3. Click **Export for AppVelocity**
4. Downloads `appvelocity-export.zip`
5. Upload the ZIP to AppVelocity web UI (instead of pasting a Figma URL)

## ZIP Contents

```
appvelocity-export.zip
  ├── figma-export.json   — design tree + rendered bounds + variant properties
  └── assets/
       ├── <nodeId>.png   — image fills exported at @2x
       └── ...
```
