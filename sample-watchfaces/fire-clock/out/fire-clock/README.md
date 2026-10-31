# Fire Clock

Zeus CLI watchface project exported by **Dialcraft**.

- Target: Amazfit Bip 6 (`bip-6`, 390×450)
- designWidth: 390
- Assets: `assets/bip-6/images/`
- Code: `watchface/bip-6/index.js`

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
