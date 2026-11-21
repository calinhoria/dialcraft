{
  /*GEO*/
  // picture indexes, per slot (the order the build gave them)
  const GL = { off: 0 }, RET = { lock: 0, search: 1, close: 2, off: 3 }, LED = { on: 0, dim: 1, off: 2 };
  const HW = 2 * G.DW + G.SP;
  const S = {};
  const put = (h, x, y, i) => {
    const k = x + '|' + y + '|' + i;
    if (S[h] === k) return;
    S[h] = k;
    W[h].setProperty(ui.prop.MORE, { x: pxv(x), y: pxv(y), src: F[h][i] });
  };
  const hide = (h, x, y, off) => put(h, x, y, off);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const tick = () => {
    const now = Date.now(), d = new Date(now);
    const s = d.getSeconds() + (now % 1000) / 1000, mm = d.getMinutes();
    let busy = false;

    // 1. new minute: the minute digits recalibrate for 0.7 s (cover the real ones, show the sliced pair, jitter)
    if (s < 0.7) {
      busy = true;
      const j = s < 0.25 ? 3 : s < 0.5 ? -2 : 1;
      put('cover', G.CV[0], G.CV[1], 1);
      put('gM1', G.MX + j, G.Y, 1 + Math.floor(mm / 10));
      put('gM2', G.MX + G.DW + G.SP - j, G.Y, 1 + (mm % 10));
    } else {
      hide('cover', G.CV[0], G.CV[1], 0);
      hide('gM1', G.MX, G.Y, GL.off);
      hide('gM2', G.MX + G.DW + G.SP, G.Y, GL.off);
    }

    // 2. scan beam: sweeps the visor top to bottom every 6 s
    const ph = (now / 1000) % 6, bx = Math.round(195 - G.BEAM[0] / 2);
    if (ph < 1.4) {
      busy = true;
      put('beam', bx, Math.round(150 + (ph / 1.4) * 122 - G.BEAM[1] / 2), 1);
    } else hide('beam', bx, 200, 0);

    // 3. target lock, seconds 18-31: search the visor, close in, lock on the hour or the minutes, blink out
    const t = s - 18, R2 = G.RS / 2;
    let lock = false;
    if (t >= 0 && t < 13) {
      busy = true;
      const tx = (mm % 2 ? G.MX : G.HX) + HW / 2, ty = G.Y + 50;
      const sx = (u) => 195 + 110 * Math.sin(u * 1.7 + 0.5), sy = (u) => G.Y + 50 + 22 * Math.sin(u * 2.9);
      if (t < 5) put('ret', Math.round(sx(t) - R2), Math.round(sy(t) - R2), RET.search);
      else if (t < 6) {
        const k = ease(t - 5), x0 = sx(5), y0 = sy(5);
        put('ret', Math.round(x0 + (tx - x0) * k - R2), Math.round(y0 + (ty - y0) * k - R2), RET.close);
      } else {
        lock = true;
        const on = t < 11 || Math.floor(t * 8) % 2 === 0;
        put('ret', Math.round(tx - R2), Math.round(ty - R2), on ? RET.lock : RET.off);
      }
    } else hide('ret', 127, 143, RET.off);

    // 4. status light: a double pulse, fast while locked
    let ledOn;
    if (lock) ledOn = Math.floor(now / 125) % 2 === 0;
    else { const m = now % 2400; ledOn = m < 160 || (m >= 320 && m < 480); }
    put('led', 108, 23, ledOn ? LED.on : LED.dim);

    return busy || (s > 17.6 && s < 18) || s > 59.8 || ph > 5.85 ? 80 : 150;
  };

  let gen = 0, run = false;
  const loop = (g) => {
    if (!run || g !== gen) return;
    let ms = 150;
    try { ms = tick(); } catch (e) { /* a bad frame must not stop the loop */ }
    try { setTimeout(() => loop(g), ms); } catch (e) {}
  };
  const start = () => { gen++; run = true; loop(gen); };
  const stop = () => { run = false; gen++; };
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop });
  start();
}
