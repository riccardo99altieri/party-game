// Collegamento WebSocket con il server: riconnessione automatica e orologio
// sincronizzato (tipo NTP) per i giochi dove conta il millisecondo.

export function connect({ role, token = () => null, onMessage, onStatus }) {
  let ws = null;
  let queue = [];
  let open = false;
  let retry = 400;
  let timer = null;
  let pingTimer = null;
  let lastPong = 0;
  let offset = 0; // oraServer - performance.now()
  let bestRtt = Infinity;
  let samples = [];
  let closedForever = false;

  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

  function status(s) {
    if (onStatus) onStatus(s);
  }

  function sendRaw(obj) {
    if (open && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  function ping() {
    sendRaw({ t: 'ping', c: performance.now() });
  }

  function start() {
    if (closedForever) return;
    clearTimeout(timer);
    try {
      ws = new WebSocket(url);
    } catch {
      return schedule();
    }
    const me = ws;
    ws.onopen = () => {
      if (me !== ws) return;
      open = true;
      retry = 400;
      lastPong = performance.now();
      sendRaw({ t: 'hello', role, token: token() });
      // Raffica iniziale per l'orologio, poi un ping ogni 3 secondi.
      for (let i = 0; i < 6; i++) setTimeout(ping, i * 120);
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (performance.now() - lastPong > 9000) {
          // Connessione "zombie": la chiudiamo e ripartiamo.
          try {
            ws.close();
          } catch {}
          onClose();
          return;
        }
        ping();
      }, 3000);
      const q = queue;
      queue = [];
      for (const m of q) sendRaw(m);
      status('open');
    };
    ws.onmessage = (ev) => {
      if (me !== ws) return;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.t === 'pong') {
        const now = performance.now();
        lastPong = now;
        const rtt = now - msg.c;
        samples.push({ rtt, off: msg.s - (msg.c + rtt / 2) });
        if (samples.length > 12) samples.shift();
        // Il campione con il viaggio più breve è il più affidabile.
        const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
        bestRtt = best.rtt;
        offset = best.off;
        return;
      }
      if (onMessage) onMessage(msg);
    };
    ws.onclose = () => {
      if (me === ws) onClose();
    };
    ws.onerror = () => {};
  }

  function onClose() {
    const wasOpen = open;
    open = false;
    clearInterval(pingTimer);
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = null;
    }
    ws = null;
    if (wasOpen) status('closed');
    schedule();
  }

  function schedule() {
    if (closedForever) return;
    clearTimeout(timer);
    timer = setTimeout(start, retry);
    retry = Math.min(retry * 1.6, 3000);
  }

  // Quando il telefono si risveglia, riproviamo subito.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !open) {
      retry = 200;
      schedule();
    }
  });

  start();

  return {
    send(obj) {
      if (open) sendRaw(obj);
      else if (obj.t !== 'in') queue.push(obj); // gli input vecchi non servono
    },
    // Ora del server in millisecondi (stessa base per schermo e telefoni).
    now: () => performance.now() + offset,
    rtt: () => bestRtt,
    isOpen: () => open,
    close() {
      closedForever = true;
      clearTimeout(timer);
      clearInterval(pingTimer);
      if (ws) ws.close();
    },
  };
}
