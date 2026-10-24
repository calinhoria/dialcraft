  // ---- shared runtime: slot setter that skips unchanged calls, and a loop that runs only while the face is on screen ----
  const SL = {};
  const slot = (h) => {
    if (SL[h]) return SL[h];
    const w = W[h], f = F[h]; let key = '';
    const s = (x, y, i, ww, hh) => {
      const k = x + '|' + y + '|' + i + '|' + ww + '|' + hh;
      if (k === key) return;
      key = k;
      const p = { x: pxv(x), y: pxv(y) };
      if (i !== undefined) p.src = f[i];
      if (ww !== undefined) { p.w = pxv(ww); p.h = pxv(hh); }
      w.setProperty(ui.prop.MORE, p);
    };
    s.hide = () => { if (key === 'hide') return; key = 'hide'; w.setProperty(ui.prop.MORE, { src: f[V[h].__blank] }); };
    return (SL[h] = s);
  };
  let gen = 0, running = false;
  const safe = () => { try { tick(); } catch (e) { /* a bad frame must not stop the loop */ } };
  const loop = (g) => {
    if (!running || g !== gen) return;
    safe();
    if (running && g === gen) { try { setTimeout(() => loop(g), MS); } catch (e) {} }
  };
  const start = () => {
    gen++; running = true; const g = gen;
    try { setTimeout(() => loop(g), MS); } catch (e) {}
    safe();
  };
  const stop = () => { running = false; gen++; };
  ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: start, pause_call: stop });
  start();
