{
  // Bon fiscal: each minute the receipt is printed line by line from the top, held, and wiped
  const MS = 100, PT = /*PT*/0, PH = /*PH*/0, PX = /*PX*/0, LH = 22;
  /*V*/
  const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const tick = () => {
    const now = Date.now(), d = new Date(now), sec = d.getSeconds() + (now % 1000) / 1000;
    let cy = PT - 6, ch = PH + 6;
    if (sec < 0.6) { /* paper still blank */ }
    else if (sec < 6.0) { const r = Math.round(ease((sec - 0.6) / 5.4) * PH / LH) * LH; cy = PT - 6 + r; ch = PH + 6 - r; }
    else if (sec < 58.6) { ch = 0; }
    else { const k = ease((sec - 58.6) / 1.0); ch = Math.round((PH + 6) * k); }
    if (ch > 1) slot('cover')(PX - 8, cy, V.cover.s, 286, ch); else slot('cover').hide();
    if (sec >= 0.6 && sec < 6.0 && ch > 1) slot('head')(PX, cy - 3, V.head.s); else slot('head').hide();
  };
  /*RUNTIME*/
}
