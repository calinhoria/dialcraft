{
  // Island Cocktail: everything follows the real clock (Date.now), so the scene is the same whenever you look
  const MS = 120, GX = 84, GY = 212, HOR = 208;
  /*V*/
  const tick = () => {
    const now = Date.now();
    // two sailboats drift along the horizon, in opposite directions and at different speeds
    // (hidden at the very edges, so a boat never sits half off the screen)
    const xa = Math.round(-30 + ((now % 110000) / 110000) * 450); if (xa > 1 && xa < 364) slot('boatA')(xa, HOR - 18, V.boatA.s); else slot('boatA').hide();
    const xb = Math.round(400 - ((now % 170000) / 170000) * 430); if (xb > 1 && xb < 371) slot('boatB')(xb, HOR - 13, V.boatB.s); else slot('boatB').hide();
    // a speedboat crosses the middle of the bay every 50 s (16 s pass)
    const pm = (now % 50000) / 1000;
    if (pm < 16) slot('motor')(Math.round(410 - (pm / 16) * 470), 238, Math.floor(now / 250) % 2 ? V.motor.a : V.motor.b);
    else slot('motor').hide();
    // a surfer rides a swell in every 30 s (9 s ride, left to right, closer as it goes)
    const ps = (now % 30000) / 1000;
    if (ps >= 12 && ps < 21) { const t = (ps - 12) / 9; slot('surf')(Math.round(-96 + t * 500), Math.round(258 + t * 22), [V.surf.a, V.surf.b, V.surf.c][Math.floor(now / 220) % 3]); }
    else slot('surf').hide();
    // the sun glitters on the water
    slot('glit')(GX, GY, [V.glit.a, V.glit.b, V.glit.c][Math.floor(now / 420) % 3]);
    // two gulls glide across now and then (75 s loop, 20 s in view)
    const pg = (now % 75000) / 1000;
    if (pg < 20) { const t = pg / 20; slot('gull')(Math.round(400 - t * 450), Math.round(150 + 8 * Math.sin(t * 9)), Math.floor(now / 380) % 2 ? V.gull.u : V.gull.d); }
    else slot('gull').hide();
  };
  /*RUNTIME*/
}
