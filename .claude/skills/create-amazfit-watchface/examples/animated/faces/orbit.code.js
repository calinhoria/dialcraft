{
  // Orbit: the view from a space station. The night side of the Earth is the real time of day, a satellite and the odd shooting star cross.
  const MS = 150;
  /*V*/
  const tick = () => {
    const now = Date.now(), d = new Date(now);
    // the day / night line follows the local time (one picture per hour, 15 degrees each)
    const hh = d.getHours() + d.getMinutes() / 60;
    slot('night')(0, 220, V.night['h' + (Math.floor(hh + 0.5) % 24)]);
    // the stars twinkle in three phases
    slot('tw')(0, 0, [V.tw.a, V.tw.b, V.tw.c][Math.floor(now / 900) % 3]);
    // a satellite crosses the sky every 52 s, its beacon blinking
    const p = (now % 52000) / 52000, sx = Math.round(-50 + p * 490);
    if (sx > -44 && sx < 386) slot('sat')(sx, Math.round(176 + 9 * Math.sin(p * 6.283)), Math.floor(now / 500) % 2 ? V.sat.a : V.sat.b);
    else slot('sat').hide();
    // a shooting star every 37 s, a second long
    const q = (now % 37000) / 1100;
    if (q < 1) slot('shoot')(Math.round(330 - q * 250), Math.round(22 + q * 130), V.shoot.s);
    else slot('shoot').hide();
  };
  /*RUNTIME*/
}
