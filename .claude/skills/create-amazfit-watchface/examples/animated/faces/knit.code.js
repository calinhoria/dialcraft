{
  // Knitted Time: the needles click, the ball of yarn rocks, and one minute of scarf grows from the needles (it restarts every minute)
  const MS = 130;
  /*V*/
  const tick = () => {
    const now = Date.now(), sec = (now % 60000) / 1000;
    slot('ball')(34 + Math.round(2 * Math.sin(now / 650)), 372, V.ball['f' + (Math.floor(now / 260) % 8)]);
    slot('needles')(232, 292, Math.floor(now / 500) % 2 ? V.needles.a : V.needles.b);
    const h = Math.round(80 * sec / 60);
    if (h >= 3) slot('swatch')(248, 322, V.swatch.s, 44, h); else slot('swatch').hide();
  };
  /*RUNTIME*/
}
