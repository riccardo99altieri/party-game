// Registro dei minigiochi. Per aggiungerne uno: crea la cartella games/<id>/
// con host.js e phone.js (vedi LEGGIMI.md) e aggiungi l'id qui sotto.

export const ELENCO = ['sumo', 'lumache', 'bocce', 'filo', 'manoferma', 'galleria', 'colore', 'twister', 'fuoco', 'unico', 'ali', 'polpo', 'bomba', 'pollici', 'circo', 'intruso', 'uomonero', 'fightclub', 'abduction'];

// Icone e nomi dei tipi di controllo (per le schede del catalogo).
export const CONTROLLI = {
  joystick: { emoji: '🕹️', nome: 'Joystick' },
  manovella: { emoji: '🔄', nome: 'Manovella' },
  fionda: { emoji: '🎯', nome: 'Fionda' },
  traccia: { emoji: '〰️', nome: 'Percorso' },
  precisione: { emoji: '✏️', nome: 'Precisione' },
  disegno: { emoji: '🎨', nome: 'Disegno' },
  colore: { emoji: '🌈', nome: 'Colori' },
  multitouch: { emoji: '🖐️', nome: 'Multi-touch' },
  pulsante: { emoji: '🔴', nome: 'Riflessi' },
  scelta: { emoji: '🔢', nome: 'Strategia' },
  raffica: { emoji: '👆', nome: 'Tocca a raffica' },
  ruoli: { emoji: '🐙', nome: 'Uno contro tutti' },
  gesti: { emoji: '🤏', nome: 'Gesti' },
  pollici: { emoji: '👍', nome: 'Due pollici' },
  cooperativo: { emoji: '🤝', nome: 'Cooperativo' },
  stealth: { emoji: '🥷', nome: 'Nascondino' },
  buio: { emoji: '🔦', nome: 'Uno contro tutti al buio' },
  duello: { emoji: '🥊', nome: 'Scommesse e duelli' },
  mandria: { emoji: '🐄', nome: 'Mimetizzati e bruca' },
};

export async function caricaHost() {
  const moduli = await Promise.all(ELENCO.map((id) => import(`./${id}/host.js`)));
  return moduli.map((m) => m.default);
}

const cachePhone = {};
export async function caricaPhone(id) {
  if (!ELENCO.includes(id)) throw new Error(`Minigioco sconosciuto: ${id}`);
  if (!cachePhone[id]) cachePhone[id] = import(`./${id}/phone.js`).then((m) => m.default);
  return cachePhone[id];
}
