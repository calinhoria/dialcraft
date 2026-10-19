# Sample Digital

Zeus CLI watchface project exported by **Dialcraft**.

- Target: Amazfit GTR 3 Pro (`gtr-3-pro`, 480×480)
- designWidth: 480
- Assets: `assets/gtr-3-pro/images/`
- Code: `watchface/gtr-3-pro/index.js`
- Fonts: `assets/gtr-3-pro/fonts/Orbitron-Bold.ttf` — referenced by Text widgets as `font: 'fonts/<file>'`

## Build / preview

```bash
npm i @zeppos/zeus-cli -g
zeus dev        # live preview in the Zepp OS simulator
zeus preview    # QR code for the Zepp app (developer mode)
zeus build      # installable package in dist/
```

Add more devices by copying the `targets` block in `app.json` (the key must
match the `assets/<key>.<st>` folder) — see the device list in the docs:
https://docs.zepp.com/docs/reference/related-resources/device-list/
