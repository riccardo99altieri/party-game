'use strict';

// Party game — server di rete locale.
// Zero dipendenze: solo moduli standard di Node.js (>= 18).
// Avvio: node server.js [--open]
//
// Il computer apre /schermo (la "console": logica e grafica dei minigiochi),
// i telefoni aprono /gioca (i controller). Il server tiene l'elenco dei
// giocatori e fa da ponte tra lo schermo e i telefoni via WebSocket.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');
const { performance } = require('perf_hooks');

const PORT = Number(process.env.PORT) || 3100;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
// I personaggi creati restano salvati qui (PG_DATI serve ai test per usare un'altra cartella).
const DATA_DIR = process.env.PG_DATI ? path.resolve(process.env.PG_DATI) : path.join(__dirname, 'dati');
const CHARS_FILE = path.join(DATA_DIR, 'personaggi.json');
const MAX_CHARS = 80;

const MAX_PLAYERS = 16;
const NAME_MAX = 16;
const WS_MAX_MESSAGE = 4 * 1024 * 1024;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// ---------------------------------------------------------------------------
// Utilità

const newToken = () => crypto.randomBytes(18).toString('base64url');
const newId = () => crypto.randomBytes(5).toString('base64url');
const serverNow = () => performance.timeOrigin + performance.now();

function cleanName(value) {
  if (typeof value !== 'string') return '';
  const flat = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(flat).slice(0, NAME_MAX).join('').trim();
}

// L'avatar è un oggetto di piccoli numeri interi: teniamo solo quelli.
function cleanAvatar(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [k, v] of Object.entries(value)) {
    if (Object.keys(out).length >= 40) break;
    if (/^[a-zA-Z]{1,24}$/.test(k) && Number.isInteger(v) && v >= 0 && v < 100) out[k] = v;
  }
  return out;
}

const validPid = (v) => typeof v === 'string' && /^[\w-]{4,24}$/.test(v);

function lanAddresses() {
  const found = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if ((a.family !== 'IPv4' && a.family !== 4) || a.internal || a.address.startsWith('169.254.')) continue;
      let score = 0;
      if (a.address.startsWith('192.168.')) score += 30;
      else if (a.address.startsWith('10.')) score += 20;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score += 10;
      if (/vethernet|virtual|vmware|vbox|hyper-v|wsl|docker|loopback|tailscale|zerotier|hamachi|vpn/i.test(name)) score -= 50;
      if (/wi-?fi|wlan|wireless|ethernet|^eth|^en\d/i.test(name)) score += 5;
      found.push({ address: a.address, name, score });
    }
  }
  return found.sort((a, b) => b.score - a.score).map((a) => ({ address: a.address, name: a.name }));
}

// ---------------------------------------------------------------------------
// WebSocket minimale (RFC 6455): solo quello che serve a noi.

class WsConn {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.fragments = null;
    this.fragOpcode = 0;
    this.closed = false;
    this.lastSeen = Date.now();
    this.onmessage = null;
    this.onclose = null;
    socket.setNoDelay(true);
    socket.on('data', (chunk) => this.feed(chunk));
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }

  feed(chunk) {
    this.lastSeen = Date.now();
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (!this.closed) {
      const buf = this.buf;
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0;
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        const big = buf.readBigUInt64BE(2);
        if (big > BigInt(WS_MAX_MESSAGE)) return this.fail(1009);
        len = Number(big);
        off = 10;
      }
      if (len > WS_MAX_MESSAGE) return this.fail(1009);
      if (!masked) return this.fail(1002);
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      off += 4;
      const payload = Buffer.from(buf.subarray(off, off + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = buf.subarray(off + len);
      this.handleFrame(fin, opcode, payload);
    }
  }

  handleFrame(fin, opcode, payload) {
    if (opcode === 0x8) {
      this.sendFrame(0x8, payload.subarray(0, 2));
      this.socket.end();
      this.finish();
      return;
    }
    if (opcode === 0x9) return this.sendFrame(0xa, payload);
    if (opcode === 0xa) return;
    if (opcode === 0x0) {
      if (!this.fragments) return this.fail(1002);
      this.fragments.push(payload);
      const total = this.fragments.reduce((n, b) => n + b.length, 0);
      if (total > WS_MAX_MESSAGE) return this.fail(1009);
      if (fin) {
        const whole = Buffer.concat(this.fragments);
        const op = this.fragOpcode;
        this.fragments = null;
        this.deliver(op, whole);
      }
      return;
    }
    if (opcode === 0x1 || opcode === 0x2) {
      if (fin) this.deliver(opcode, payload);
      else {
        this.fragments = [payload];
        this.fragOpcode = opcode;
      }
      return;
    }
    this.fail(1002);
  }

  deliver(opcode, data) {
    if (opcode !== 0x1 || !this.onmessage) return;
    let msg;
    try {
      msg = JSON.parse(data.toString('utf8'));
    } catch {
      return;
    }
    if (msg && typeof msg === 'object') {
      try {
        this.onmessage(msg);
      } catch (err) {
        console.error('Errore nel gestire un messaggio:', err);
      }
    }
  }

  sendFrame(opcode, payload) {
    if (this.closed || this.socket.destroyed) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    header[0] = 0x80 | opcode;
    this.socket.write(Buffer.concat([header, payload]));
  }

  send(obj) {
    this.sendText(JSON.stringify(obj));
  }

  sendText(text) {
    this.sendFrame(0x1, Buffer.from(text, 'utf8'));
  }

  ping() {
    this.sendFrame(0x9, Buffer.alloc(0));
  }

  fail(code) {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(code, 0);
    this.sendFrame(0x8, b);
    this.socket.end();
    this.finish();
  }

  close() {
    if (this.closed) return;
    this.sendFrame(0x8, Buffer.from([0x03, 0xe8]));
    this.socket.end();
    this.finish();
  }

  finish() {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
    if (this.onclose) this.onclose();
  }
}

const allConns = new Set();

// Controllo di vita: chi non manda più niente (telefono in tasca) viene chiuso,
// così al risveglio si ricollega pulito.
setInterval(() => {
  const now = Date.now();
  for (const c of allConns) {
    if (now - c.lastSeen > 40000) c.finish();
    else c.ping();
  }
}, 15000).unref();

// ---------------------------------------------------------------------------
// La festa: un solo schermo, fino a 16 giocatori.

const party = {
  host: null, // WsConn dello schermo
  players: new Map(), // id -> giocatore
  saved: null, // salvataggio dello stato del torneo mandato dallo schermo
};

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    color: p.color,
    bot: p.bot,
    connected: p.bot || !!p.conn,
    joinedAt: p.joinedAt,
    pid: p.pid || null,
    level: p.bot ? p.level : null,
  };
}

// Potenza delle CPU: 0 facile, 1 normale, 2 difficile.
const cleanLevel = (v) => (v === 0 || v === 1 || v === 2 ? v : 1);

function uniqueName(wanted, exceptId) {
  const taken = new Set([...party.players.values()].filter((p) => p.id !== exceptId).map((p) => p.name.toLowerCase()));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let i = 2; ; i++) {
    const candidate = `${Array.from(wanted).slice(0, NAME_MAX - 3).join('')} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function freeColor(wanted, exceptId) {
  const taken = new Set([...party.players.values()].filter((p) => p.id !== exceptId).map((p) => p.color));
  if (Number.isInteger(wanted) && wanted >= 0 && wanted < MAX_PLAYERS && !taken.has(wanted)) return wanted;
  for (let c = 0; c < MAX_PLAYERS; c++) if (!taken.has(c)) return c;
  return 0;
}

function sendHost(obj) {
  if (party.host) party.host.send(obj);
}

function lobbySummary() {
  return [...party.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.bot, connected: p.bot || !!p.conn }));
}

// Ai telefoni basta sapere chi c'è (per esempio per i colori già presi).
function broadcastLobby() {
  const text = JSON.stringify({ t: 'lobby', players: lobbySummary(), max: MAX_PLAYERS });
  for (const p of party.players.values()) if (p.conn) p.conn.sendText(text);
  for (const c of waitingPhones) c.sendText(text);
  broadcastChars();
}

function announcePlayer(p) {
  sendHost({ t: 'player', p: publicPlayer(p) });
  broadcastLobby();
}

function createPlayer(name, avatar, bot) {
  const p = {
    id: newId(),
    token: newToken(),
    name: uniqueName(name),
    avatar,
    color: 0,
    bot: !!bot,
    pid: null, // personaggio salvato
    conn: null,
    view: null,
    joinedAt: Date.now() + party.players.size / 1000,
  };
  p.color = freeColor(avatar.colore);
  p.avatar.colore = p.color;
  party.players.set(p.id, p);
  return p;
}

function applyProfile(p, name, avatar) {
  if (name) p.name = uniqueName(name, p.id);
  if (Object.keys(avatar).length) {
    p.avatar = avatar;
    p.color = freeColor(avatar.colore, p.id);
    p.avatar.colore = p.color;
  }
}

function removePlayer(p, reason) {
  party.players.delete(p.id);
  if (p.conn) {
    p.conn.send({ t: 'removed', reason });
    p.conn.player = null;
    waitingPhones.add(p.conn);
  }
  sendHost({ t: 'gone', id: p.id });
  broadcastLobby();
}

// Telefoni collegati che non hanno ancora un giocatore (stanno creando l'avatar).
const waitingPhones = new Set();

// ---------------------------------------------------------------------------
// Personaggi salvati sul computer: chi torna li ritrova (anche da un altro telefono).

function loadChars() {
  try {
    const list = JSON.parse(fs.readFileSync(CHARS_FILE, 'utf8'));
    if (!Array.isArray(list)) return [];
    return list
      .filter((c) => c && validPid(c.id))
      .map((c) => ({ id: c.id, name: cleanName(c.name) || 'Senza nome', avatar: cleanAvatar(c.avatar), updated: Number(c.updated) || 0 }))
      .slice(0, MAX_CHARS);
  } catch {
    return [];
  }
}

const chars = loadChars();
let charsTimer = null;

function writeChars() {
  clearTimeout(charsTimer);
  charsTimer = null;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${CHARS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(chars, null, 1));
    fs.renameSync(tmp, CHARS_FILE);
  } catch (err) {
    console.error('Non riesco a salvare i personaggi:', err.message);
  }
}

function saveChars() {
  clearTimeout(charsTimer);
  charsTimer = setTimeout(writeChars, 300);
}

function upsertChar(pid, name, avatar) {
  let c = chars.find((x) => x.id === pid);
  if (!c) {
    c = { id: pid };
    chars.push(c);
  }
  c.name = name;
  c.avatar = avatar;
  c.updated = Date.now();
  chars.sort((a, b) => b.updated - a.updated);
  if (chars.length > MAX_CHARS) chars.length = MAX_CHARS;
  saveChars();
}

// use: 'on' = sta giocando da un telefono collegato, 'off' = è nella festa ma il telefono è spento.
function charsSummary() {
  const used = new Map();
  for (const p of party.players.values()) if (p.pid && !p.bot) used.set(p.pid, p.conn ? 'on' : 'off');
  return chars.map((c) => ({ id: c.id, name: c.name, avatar: c.avatar, use: used.get(c.id) || null }));
}

// La galleria la vedono i telefoni che stanno entrando e lo schermo (che li gestisce).
function broadcastChars() {
  if (!waitingPhones.size && !party.host) return;
  const text = JSON.stringify({ t: 'chars', list: charsSummary() });
  for (const c of waitingPhones) c.sendText(text);
  if (party.host) party.host.sendText(text);
}

// Restituisce il motivo se non si può eliminare, altrimenti elimina.
function deleteChar(pid, { evenOffline = true } = {}) {
  const p = [...party.players.values()].find((x) => x.pid === pid && !x.bot);
  if (p && p.conn) return 'Questo personaggio sta giocando: non si può eliminare adesso';
  if (p && !evenOffline) return `${p.name} è nella festa: toglilo prima dalla festa`;
  const i = chars.findIndex((c) => c.id === pid);
  if (i >= 0) {
    chars.splice(i, 1);
    saveChars();
  }
  broadcastChars();
  return null;
}

// Lo schermo crea o modifica un personaggio salvato. Se è nella festa, cambia
// anche il giocatore (e il suo telefono se ne accorge subito).
function saveCharFromHost(conn, msg) {
  const name = cleanName(msg.name);
  if (!name) return conn.send({ t: 'notice', text: 'Il personaggio ha bisogno di un nome' });
  const avatar = cleanAvatar(msg.avatar);
  let pid = validPid(msg.pid) && chars.some((c) => c.id === msg.pid) ? msg.pid : null;
  if (!pid) {
    if (chars.length >= MAX_CHARS) return conn.send({ t: 'notice', text: `Ci sono già ${MAX_CHARS} personaggi salvati: eliminane qualcuno` });
    pid = newId();
  }
  const p = [...party.players.values()].find((x) => x.pid === pid && !x.bot);
  if (!p) {
    upsertChar(pid, name, avatar);
    broadcastChars();
    return;
  }
  applyProfile(p, name, avatar);
  upsertChar(pid, name, p.avatar);
  if (p.conn) p.conn.send({ t: 'you', you: publicPlayer(p), nome: name });
  announcePlayer(p);
}

// Prima di chiudere con Ctrl+C scriviamo le ultime modifiche.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(sig, () => {
    if (charsTimer) writeChars();
    process.exit(0);
  });
}

function targets(to) {
  if (to === '*') return [...party.players.values()];
  const ids = Array.isArray(to) ? to : [to];
  return ids.map((id) => party.players.get(id)).filter(Boolean);
}

function onHostMessage(conn, msg) {
  switch (msg.t) {
    case 'view': {
      // Schermata "persistente" del telefono: la ricordiamo per chi si riconnette.
      const text = JSON.stringify({ t: 'view', v: msg.v });
      for (const p of targets(msg.to)) {
        p.view = msg.v;
        if (p.conn) p.conn.sendText(text);
      }
      break;
    }
    case 'msg': {
      const text = JSON.stringify({ t: 'msg', d: msg.d });
      for (const p of targets(msg.to)) if (p.conn) p.conn.sendText(text);
      break;
    }
    case 'save':
      party.saved = msg.s ?? null;
      break;
    case 'addbot': {
      if (party.players.size >= MAX_PLAYERS) return conn.send({ t: 'notice', text: 'La festa è piena (16 giocatori)' });
      const p = createPlayer(cleanName(msg.name) || 'Bot', cleanAvatar(msg.avatar), true);
      p.level = cleanLevel(msg.level);
      announcePlayer(p);
      break;
    }
    case 'botlevel': {
      const p = party.players.get(msg.id);
      if (!p || !p.bot) return;
      p.level = cleanLevel(msg.level);
      announcePlayer(p);
      break;
    }
    case 'kick': {
      const p = party.players.get(msg.id);
      if (p) removePlayer(p, 'Lo schermo ti ha tolto dalla festa');
      break;
    }
    case 'charsave':
      saveCharFromHost(conn, msg);
      break;
    case 'chardel': {
      if (!validPid(msg.pid)) return;
      const why = deleteChar(msg.pid, { evenOffline: false });
      if (why) conn.send({ t: 'notice', text: why });
      break;
    }
    case 'ping':
      conn.send({ t: 'pong', c: msg.c, s: serverNow() });
      break;
  }
}

function onPhoneMessage(conn, msg) {
  const p = conn.player;
  switch (msg.t) {
    case 'join': {
      if (p) return conn.send({ t: 'joined', you: publicPlayer(p), token: p.token });
      const name = cleanName(msg.name);
      if (!name) return conn.send({ t: 'error', text: 'Scrivi il tuo nome' });
      const avatar = cleanAvatar(msg.avatar);
      const pid = validPid(msg.pid) ? msg.pid : null;
      // Personaggio già nella festa ma con il telefono spento (o da un altro
      // telefono): riprende il suo posto, con i suoi punti.
      const old = pid && [...party.players.values()].find((x) => x.pid === pid && !x.bot);
      if (old) {
        if (old.conn) return conn.send({ t: 'error', text: 'Questo personaggio sta già giocando su un altro telefono' });
        old.token = newToken();
        old.conn = conn;
        conn.player = old;
        waitingPhones.delete(conn);
        applyProfile(old, name, avatar);
        upsertChar(old.pid, name, old.avatar);
        conn.send({ t: 'joined', you: publicPlayer(old), token: old.token, host: !!party.host, view: old.view });
        announcePlayer(old);
        break;
      }
      if (party.players.size >= MAX_PLAYERS) return conn.send({ t: 'error', text: 'La festa è piena: siete già in 16!' });
      const np = createPlayer(name, avatar, false);
      np.pid = pid || newId();
      np.conn = conn;
      conn.player = np;
      waitingPhones.delete(conn);
      upsertChar(np.pid, name, np.avatar);
      conn.send({ t: 'joined', you: publicPlayer(np), token: np.token, host: !!party.host });
      announcePlayer(np);
      break;
    }
    case 'profile': {
      if (!p) return;
      const name = cleanName(msg.name);
      applyProfile(p, name, cleanAvatar(msg.avatar));
      if (p.pid) upsertChar(p.pid, name || chars.find((c) => c.id === p.pid)?.name || p.name, p.avatar);
      conn.send({ t: 'you', you: publicPlayer(p) });
      announcePlayer(p);
      break;
    }
    case 'delchar': {
      if (!validPid(msg.pid)) return;
      const why = deleteChar(msg.pid);
      if (why) conn.send({ t: 'error', text: why });
      break;
    }
    case 'in':
      if (p && party.host) party.host.send({ t: 'in', p: p.id, d: msg.d });
      break;
    case 'sys':
      if (p && party.host) party.host.send({ t: 'sys', p: p.id, d: msg.d });
      break;
    case 'leave':
      if (p) removePlayer(p, 'Sei uscito dalla festa');
      break;
    case 'ping':
      conn.send({ t: 'pong', c: msg.c, s: serverNow() });
      break;
  }
}

function onHello(conn, msg) {
  if (msg.role === 'host') {
    if (party.host && party.host !== conn) {
      party.host.send({ t: 'replaced' });
      party.host.close();
    }
    conn.role = 'host';
    party.host = conn;
    conn.send({
      t: 'welcome',
      role: 'host',
      players: [...party.players.values()].map(publicPlayer),
      saved: party.saved,
      lan: lanAddresses(),
      port: activePort,
      max: MAX_PLAYERS,
      chars: charsSummary(),
      maxChars: MAX_CHARS,
    });
    for (const p of party.players.values()) if (p.conn) p.conn.send({ t: 'host', online: true });
    for (const c of waitingPhones) c.send({ t: 'host', online: true });
    return;
  }

  conn.role = 'phone';
  const p = typeof msg.token === 'string' ? [...party.players.values()].find((x) => x.token === msg.token && !x.bot) : null;
  if (p) {
    if (p.conn && p.conn !== conn) {
      p.conn.player = null;
      p.conn.send({ t: 'removed', reason: 'Ti sei collegato da un altro dispositivo' });
      p.conn.close();
    }
    p.conn = conn;
    conn.player = p;
    conn.send({ t: 'welcome', role: 'phone', you: publicPlayer(p), token: p.token, view: p.view, host: !!party.host });
    announcePlayer(p);
  } else {
    waitingPhones.add(conn);
    conn.send({ t: 'welcome', role: 'phone', you: null, host: !!party.host, full: party.players.size >= MAX_PLAYERS, chars: charsSummary() });
    conn.send({ t: 'lobby', players: lobbySummary(), max: MAX_PLAYERS });
  }
}

function onConnection(conn) {
  allConns.add(conn);
  conn.onmessage = (msg) => {
    if (msg.t === 'hello') return onHello(conn, msg);
    if (conn.role === 'host' && party.host === conn) return onHostMessage(conn, msg);
    if (conn.role === 'phone') return onPhoneMessage(conn, msg);
  };
  conn.onclose = () => {
    allConns.delete(conn);
    waitingPhones.delete(conn);
    if (party.host === conn) {
      party.host = null;
      for (const p of party.players.values()) if (p.conn) p.conn.send({ t: 'host', online: false });
    }
    const p = conn.player;
    if (p && p.conn === conn) {
      p.conn = null;
      announcePlayer(p);
    }
  };
}

// ---------------------------------------------------------------------------
// HTTP

function isLocal(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

function serveFile(res, rel, status = 200) {
  const full = path.join(PUBLIC_DIR, rel);
  if (!full.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Vietato');
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Non trovato');
    }
    const type = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Metodo non consentito');
  }
  const p = url.pathname;
  if (p === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(JSON.stringify({ lan: lanAddresses(), port: activePort }));
  }
  if (p === '/') return serveFile(res, isLocal(req) ? 'schermo.html' : 'gioca.html');
  if (p === '/schermo' || p === '/schermo/') return serveFile(res, 'schermo.html');
  if (p === '/gioca' || p === '/gioca/') return serveFile(res, 'gioca.html');
  let rel;
  try {
    rel = decodeURIComponent(p).replace(/^\/+/, '');
  } catch {
    rel = '';
  }
  if (!rel || rel.includes('\0')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Non trovato');
  }
  serveFile(res, path.normalize(rel));
});

server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  const isWs = String(req.headers.upgrade || '').toLowerCase() === 'websocket';
  if (!isWs || !key || !req.url.startsWith('/ws')) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  const conn = new WsConn(socket);
  onConnection(conn);
  if (head && head.length) conn.feed(head);
});

let activePort = PORT;

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function listen(port, attemptsLeft) {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0 && !process.env.PORT) {
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error(`\nImpossibile avviare il server sulla porta ${port}: ${err.message}\n`);
      process.exit(1);
    }
  };
  server.once('error', onError);
  server.listen(port, HOST, () => {
    server.removeListener('error', onError);
    activePort = port;
    const local = `http://localhost:${port}/schermo`;
    console.log('\n  PARTY GAME è pronto!\n');
    console.log(`  Schermo principale (questo computer):  ${local}`);
    for (const a of lanAddresses()) console.log(`  Telefoni (stessa Wi-Fi):               http://${a.address}:${port}/gioca`);
    console.log('\n  (Per chiudere il server premi Ctrl+C)\n');
    if (process.argv.includes('--open')) openBrowser(local);
  });
}

listen(PORT, 10);
