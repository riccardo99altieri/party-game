// Due pollici veri, simulati: servono alle CPU (host.js) e alle persone simulate del banco
// di prova (test/bench/pollici.mjs). Il "corridore" fa esattamente quello che fa un
// telefono: stessi binari (dal seme), stessa regola per uscire, stessi messaggi.
//
// Come si muove un pollice (telefono tipico di 390 x 760 px, ~6 x 12 cm, 1 px ≈ 0,16 mm):
// - insegue il suo binario visto con un attimo di ritardo; i bravi prevedono dove andrà
//   (il pezzo che arriva si vede in anticipo) e seguono meglio la pendenza;
// - l'attenzione passa ogni pochi decimi di secondo al pollice più in difficoltà: quello
//   guardato segue bene, l'altro peggio;
// - le due mani tendono a muoversi a specchio (accoppiamento bimanuale): negli specchi è
//   facile, quando i binari vanno dalla stessa parte o per conto loro una mano "trascina"
//   l'altra;
// - due pollici più vicini di ~14 mm si urtano e si spingono via: negli incroci bisogna
//   alzarne uno e abbassare l'altro, e chi se ne accorge tardi si pesta le dita;
// - incrociati o molto larghi vengono i crampi: più tremolio e un pollice che si solleva.
// Nessun errore è deciso in anticipo: si esce quando un pollice finisce davvero fuori.

import { COMODO, RIF, PAUSA, GRAZIA, TOLLERANZA, LUNGHEZZA, combo, velocita, distanza } from './pista.js';

export const TELEFONO = { w: 390, h: 760 };
const URTO = 85; // px: pollici più vicini di così si toccano
const INVIO = 0.15; // il telefono manda l'avanzamento ogni 150 ms

// Le mani di un principiante goffo e di un campione: chiunque sta in mezzo (abilità 0–1).
const PRINCIPIANTE = {
  ritardo: 0.2, // si vede il binario com'era un attimo fa (s)
  anticipa: 0.35, // quanto compensa il ritardo guardando il pezzo che arriva (0–1)
  ka: 6, // inseguimento del pollice guardato (1/s)
  kp: 3, // e dell'altro
  ffa: 0.6, // quanto segue la pendenza del binario (pollice guardato)
  ffp: 0.35, // (l'altro)
  accoppia: 0.22, // mani che vanno a specchio
  tremito: 7, // px
  ciclo: 0.45, // quanto resta l'attenzione su un pollice (s)
  distrazioni: 0.25, // al secondo
  avanti: 0.2, // quanto prima si accorge di un incrocio (schermi)
  sfalsa: 38, // negli incroci alza un pollice e abbassa l'altro (px ciascuno)
  riposo: 0, // dopo il primo incrocio li tiene un po' sfalsati (px)
  stacca: 0.02, // pollice che si solleva (al secondo, mani comode)
  crampi: 1.3,
  rimetti: 0.45, // tempo in più per rimettere i pollici sui cerchi (s)
  sbalzi: 0.35, // la concentrazione va e viene
};
const CAMPIONE = {
  ritardo: 0.13,
  anticipa: 0.85,
  ka: 10,
  kp: 6,
  ffa: 0.88,
  ffp: 0.65,
  accoppia: 0.09,
  tremito: 3.5,
  ciclo: 0.28,
  distrazioni: 0.05,
  avanti: 0.6,
  sfalsa: 62,
  riposo: 18,
  stacca: 0.004,
  crampi: 0.75,
  rimetti: 0.12,
  sbalzi: 0.2,
};

// Abilità di chi gioca, sulla scala qui sopra (misure in test/bench/pollici.mjs).
export const ABILITA = { facile: 0.27, normale: 0.35, difficile: 0.45, persona: 0.35, esperto: 0.6 };
const NEUTRO = { prudenza: 0.5, aggressivita: 0.5, costanza: 0.5, pazienza: 0.5 };

export function parametri(a, tratti = NEUTRO) {
  const { prudenza, aggressivita, costanza, pazienza } = tratti;
  const P = {};
  for (const k in PRINCIPIANTE) P[k] = PRINCIPIANTE[k] + (CAMPIONE[k] - PRINCIPIANTE[k]) * a;
  // il carattere: l'impulsivo insegue più forte, il costante trema meno e tiene meglio
  // il pollice che non guarda, il prudente guarda più avanti, il paziente si distrae meno
  P.ka *= 0.9 + 0.2 * aggressivita;
  P.kp *= 0.9 + 0.2 * costanza;
  P.tremito *= 1.1 - 0.2 * costanza;
  P.distrazioni *= 1.3 - 0.6 * pazienza;
  P.avanti *= 0.85 + 0.3 * prudenza;
  return P;
}

// Parametri della CPU: abilità del livello, con una piccola variazione personale.
export function parametriCpu(cpu) {
  const a = cpu.per(ABILITA.facile, ABILITA.normale, ABILITA.difficile) + (cpu.abilita - cpu.per(0.25, 0.55, 0.85)) * 0.5;
  return parametri(a, cpu.tratti);
}

// rnd: la CPU (ctx.cpu) oppure un oggetto con gauss, prob, num, errore, reazione.
// passo(dt, t) con t = secondi dal VIA: restituisce i messaggi che manderebbe il telefono.
export function creaCorridore(pista, P, rnd) {
  const TW = TELEFONO.w;
  const TH = TELEFONO.h;
  const base = RIF * TH;
  const alto = rnd.prob(0.5) ? 0 : 1; // negli incroci questo pollice va su, l'altro giù
  const cuscinetti = () => [0, 1].map((j) => ({ x: COMODO[j] * TW + rnd.errore(8), y: base + rnd.errore(10), n: 0, ny: 0, fuori: 0 }));
  const m = {
    st: 'attesa',
    s: 0,
    sReset: 0,
    pulito: 0,
    e: 0,
    giu: 0,
    via: rnd.num(0.02, 0.2), // i pollici sono già sui cerchi prima del VIA
    invio: 0,
    p: cuscinetti(),
    guardato: 0,
    occhiata: 0,
    distratto: 0,
    umore: 0,
    crampo: 0,
    sfalsa: 0,
    vuole: 0,
    avanti: 0,
    visto: false,
  };

  function cade(motivo, out) {
    m.st = 'giu';
    m.giu = 0;
    m.e++;
    m.pulito = 0;
    m.sReset = m.s;
    out.push({ cade: motivo, s: m.s, e: m.e });
    return out;
  }

  function passo(dt, t) {
    const out = [];
    if (m.st === 'fatto') return out;
    if (m.st === 'giu') {
      m.giu += dt;
      if (m.giu >= PAUSA) {
        // accorgersi che si può ripartire e rimettere i pollici sui due cerchi
        m.st = 'attesa';
        m.via = t + rnd.reazione() + 0.25 + P.rimetti * Math.exp(rnd.errore(0.3));
        m.p = cuscinetti();
        m.sfalsa = 0;
        m.crampo *= 0.5;
      }
      return out;
    }
    if (m.st === 'attesa') {
      if (t >= m.via) {
        m.st = 'corre';
        m.pulito = 0;
        m.invio = INVIO;
        out.push({ st: 'corre', s: m.s, c: 1, e: m.e });
      }
      return out;
    }

    // --- corre
    const c = combo(m.pulito);
    const v = velocita(m.s, c);
    m.s += v * dt;
    m.pulito += dt;
    if (m.s >= LUNGHEZZA) {
      m.st = 'fatto';
      out.push({ fatto: Math.round(t * 1000), e: m.e, s: LUNGHEZZA });
      return out;
    }
    const pos = (cc, j) => pista.pos(cc, m.sReset)[j] * TW;
    const quota = (y) => m.s + (base - y) / TH;

    // Ogni tanto guarda cosa arriva (solo il pezzo visibile sullo schermo): se i binari
    // stanno per incrociarsi, alza un pollice e abbassa l'altro.
    m.avanti -= dt;
    if (m.avanti <= 0) {
      m.avanti = rnd.num(0.2, 0.35);
      let vicino = false;
      for (let k = 0; k <= 6 && !vicino; k++) {
        const [r, b] = pista.pos(m.s - 0.1 + (P.avanti * k) / 6, m.sReset);
        if (b - r < 0.2) vicino = true;
      }
      // quanto li sfalsa cambia un po' a ogni incrocio
      if (vicino && m.vuole < P.sfalsa * 0.5) m.vuole = P.sfalsa * Math.exp(rnd.errore(0.2));
      else if (!vicino) m.vuole = m.visto ? P.riposo : 0;
      if (vicino) m.visto = true;
    }
    m.sfalsa += (m.vuole - m.sfalsa) * (1 - Math.exp(-dt * 5));
    const ty = [base, base];
    ty[alto] -= m.sfalsa;
    ty[1 - alto] += m.sfalsa;

    // attenzione: sul pollice più in difficoltà (i bravi guardano anche cosa sta arrivando)
    if (t >= m.occhiata) {
      let peggio = -Infinity;
      for (let j = 0; j < 2; j++) {
        const q = m.p[j];
        const cj = quota(q.y);
        const ora = pos(cj, j);
        const rischio = Math.abs(ora - (q.x + q.n)) + P.anticipa * Math.abs(pos(cj + 0.15, j) - ora) + rnd.errore(6);
        if (rischio > peggio) {
          peggio = rischio;
          m.guardato = j;
        }
      }
      if (rnd.prob(0.08)) m.guardato = 1 - m.guardato;
      m.occhiata = t + P.ciclo * Math.exp(rnd.errore(0.3));
    }
    if (m.distratto > 0) m.distratto -= dt;
    else if (rnd.prob(P.distrazioni * dt)) m.distratto = rnd.num(0.25, 0.7);
    m.umore += (-m.umore * dt) / 2 + P.sbalzi * Math.sqrt(dt) * rnd.gauss();

    // i due pollici inseguono i loro binari
    const u = [0, 0];
    const att = [false, false];
    for (let j = 0; j < 2; j++) {
      const q = m.p[j];
      const cv = quota(q.y) + v * P.ritardo * (P.anticipa - 1);
      const a1 = pos(cv, j);
      const tv = ((pos(cv + 0.03, j) - a1) / 0.03) * v;
      att[j] = j === m.guardato && m.distratto <= 0;
      const k = (att[j] ? P.ka : P.kp / (1 + m.crampo)) * Math.exp(m.umore);
      u[j] = k * (a1 - q.x) + (att[j] ? P.ffa : P.ffp) * tv;
    }
    for (let j = 0; j < 2; j++) {
      const q = m.p[j];
      const kap = P.accoppia * (att[j] ? 0.5 : 1);
      q.x += ((1 - kap) * u[j] - kap * u[1 - j]) * dt;
      q.y += (ty[j] - q.y) * (1 - Math.exp(-dt * 5));
      const trem = P.tremito * (1 + m.crampo) * Math.sqrt((2 * dt) / 0.25);
      q.n += (-q.n * dt) / 0.25 + trem * rnd.gauss();
      q.ny += (-q.ny * dt) / 0.25 + 0.6 * trem * rnd.gauss();
    }

    // pollici che si urtano: si spingono via (e a volte uno scivola su)
    const [A, B] = m.p;
    let dx = A.x + A.n - (B.x + B.n);
    let dy = A.y + A.ny - (B.y + B.ny);
    const dd = Math.hypot(dx, dy);
    if (dd < URTO) {
      if (dd < 1e-6) {
        dx = -1;
        dy = 0;
      }
      const k = (URTO - dd) / 2 / Math.max(dd, 1);
      A.x += dx * k;
      A.y += dy * k;
      B.x -= dx * k;
      B.y -= dy * k;
      if (rnd.prob(3 * dt)) return cade('staccato', out);
    }

    // crampi: pollice sinistro a destra dell'altro, o mani molto larghe
    const X0 = A.x + A.n;
    const X1 = B.x + B.n;
    const contorto = Math.max(0, (X0 - X1) / TW) * 1.5 + Math.max(0, Math.abs(X1 - X0) / TW - 0.62) * 3;
    m.crampo += ((contorto * P.crampi - m.crampo) * dt) / 4;
    if (rnd.prob(P.stacca * (1 + 4 * contorto + 3 * m.crampo) * dt)) return cade('staccato', out);

    // fuori dal binario? (stessa regola del telefono)
    for (let j = 0; j < 2; j++) {
      const q = m.p[j];
      const { d, semi } = distanza(pista, j, q.x + q.n, q.y + q.ny, m.s, m.sReset, TW, TH);
      if (d > semi * TOLLERANZA) {
        q.fuori += dt;
        if (q.fuori > GRAZIA) return cade('fuori', out);
      } else q.fuori = 0;
    }

    m.invio -= dt;
    if (m.invio <= 0) {
      m.invio += INVIO;
      out.push({ s: m.s, c, e: m.e, st: 'corre' });
    }
    return out;
  }

  return { m, passo };
}
