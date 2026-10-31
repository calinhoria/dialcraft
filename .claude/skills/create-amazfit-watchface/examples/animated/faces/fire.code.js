{
  // Fire clock: 12 frames of 100 ms, as in the reference: flames flicker, embers rise, the colon blinks
  const MS = 40;
  const D = /*PER*/[];
  /*V*/
  const tick = () => {
    const f = Math.floor(Date.now() / 100) % 12;
    const L = ['m', '', '', 'm', 'd', 'd'][f % 6];
    if (L) { slot('vl')(D.v[0][0], D.v[0][1], V.vl[L]); slot('vr')(D.v[1][0], D.v[1][1], V.vr[L]); } else { slot('vl').hide(); slot('vr').hide(); }
    for (let i = 0; i < 3; i++) slot('fl' + i)(D.fl[i][0], D.fl[i][1], V['fl' + i]['f' + f]);
    const em = D.e[f];
    for (let i = 0; i < 8; i++) { if (em[i]) slot('em' + i)(em[i][0], em[i][1], V['em' + i][em[i][2]]); else slot('em' + i).hide(); }
    if (f < 6) slot('colon')(D.k[0], D.k[1], V.colon.on); else slot('colon').hide();
  };
  /*RUNTIME*/
}
