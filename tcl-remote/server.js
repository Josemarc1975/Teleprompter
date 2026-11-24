'use strict';
/**
 * Controle remoto para TV TCL (Roku TV ou Android TV / Google TV).
 * Roda num PC/Raspberry/celular (Termux) na mesma rede Wi-Fi da TV.
 * Abra http://<ip-deste-computador>:3000 no celular.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const { AndroidRemote, RemoteKeyCode: K, RemoteDirection: D } = require('androidtv-remote');

// os.networkInterfaces() pode falhar no Termux/Android recente (permissão negada)
const ifaces = () => { try { return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal); } catch { return []; } };

const PORT = Number(process.env.PORT) || 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');
const PUBLIC = path.join(__dirname, 'public');

// ---------- configuração persistida ----------
let config = { type: null, host: null, cert: null };
try { config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }; } catch {}
const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });

// ---------- mapa de teclas ----------
const ROKU_KEYS = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', ok: 'Select', back: 'Back', home: 'Home',
  menu: 'Info', info: 'Info', power: 'Power', volup: 'VolumeUp', voldown: 'VolumeDown', mute: 'VolumeMute',
  play: 'Play', pause: 'Play', rev: 'Rev', fwd: 'Fwd', chup: 'ChannelUp', chdown: 'ChannelDown',
  hdmi1: 'InputHDMI1', hdmi2: 'InputHDMI2', hdmi3: 'InputHDMI3', hdmi4: 'InputHDMI4', tv: 'InputTuner',
  input: 'InputHDMI1', search: 'Search',
};
for (let i = 0; i <= 9; i++) ROKU_KEYS['n' + i] = 'Lit_' + i;

const ANDROID_KEYS = {
  up: 'KEYCODE_DPAD_UP', down: 'KEYCODE_DPAD_DOWN', left: 'KEYCODE_DPAD_LEFT', right: 'KEYCODE_DPAD_RIGHT',
  ok: 'KEYCODE_DPAD_CENTER', back: 'KEYCODE_BACK', home: 'KEYCODE_HOME', menu: 'KEYCODE_MENU',
  info: 'KEYCODE_INFO', power: 'KEYCODE_POWER', volup: 'KEYCODE_VOLUME_UP', voldown: 'KEYCODE_VOLUME_DOWN',
  mute: 'KEYCODE_VOLUME_MUTE', play: 'KEYCODE_MEDIA_PLAY_PAUSE', pause: 'KEYCODE_MEDIA_PLAY_PAUSE',
  rev: 'KEYCODE_MEDIA_REWIND', fwd: 'KEYCODE_MEDIA_FAST_FORWARD', chup: 'KEYCODE_CHANNEL_UP',
  chdown: 'KEYCODE_CHANNEL_DOWN', hdmi1: 'KEYCODE_TV_INPUT_HDMI_1', hdmi2: 'KEYCODE_TV_INPUT_HDMI_2',
  hdmi3: 'KEYCODE_TV_INPUT_HDMI_3', hdmi4: 'KEYCODE_TV_INPUT_HDMI_4', tv: 'KEYCODE_TV',
  input: 'KEYCODE_TV_INPUT', settings: 'KEYCODE_SETTINGS', guide: 'KEYCODE_GUIDE',
};
for (let i = 0; i <= 9; i++) ANDROID_KEYS['n' + i] = 'KEYCODE_' + i;

const APPS = {
  netflix: { roku: '12', android: 'https://www.netflix.com' },
  youtube: { roku: '837', android: 'https://www.youtube.com' },
  prime: { roku: '13', android: 'https://app.primevideo.com' },
  disney: { roku: '291097', android: 'https://www.disneyplus.com' },
  globoplay: { roku: '', android: 'https://globoplay.globo.com' },
  max: { roku: '61322', android: 'https://play.max.com' },
};

// ---------- Roku (ECP, HTTP porta 8060) ----------
const rokuPost = (host, p) => new Promise((resolve, reject) => {
  const req = http.request({ host, port: 8060, path: p, method: 'POST', timeout: 3000 }, (res) => {
    res.resume(); res.on('end', () => (res.statusCode < 300 ? resolve() : reject(new Error('Roku HTTP ' + res.statusCode))));
  });
  req.on('timeout', () => req.destroy(new Error('Tempo esgotado falando com a TV')));
  req.on('error', reject);
  req.end();
});

// ---------- Android TV / Google TV ----------
let atv = null;
let atvState = 'idle'; // idle | connecting | pairing | ready | error
let atvError = '';

function stopAtv() {
  try { atv && atv.remoteManager && atv.stop(); } catch {}
  atv = null; atvState = 'idle';
}

function startAtv() {
  stopAtv();
  atvState = 'connecting'; atvError = '';
  const remote = new AndroidRemote(config.host, { service_name: 'Controle TCL', cert: config.cert || {} });
  atv = remote;
  remote.on('secret', () => { atvState = 'pairing'; });
  remote.on('ready', () => {
    atvState = 'ready';
    config.cert = remote.getCertificate();
    saveConfig();
  });
  remote.on('unpaired', () => { config.cert = null; saveConfig(); atvState = 'idle'; });
  remote.on('error', (e) => { atvState = 'error'; atvError = String(e && e.message || e); });
  remote.start().then((ok) => {
    if (!ok && atv === remote && atvState === 'connecting')
      { atvState = 'error'; atvError = 'Não consegui conectar na TV. Confira o IP, o Wi-Fi e se a TV está ligada.'; }
  }).catch((e) => { atvState = 'error'; atvError = String(e && e.message || e); });
}

// ---------- ações ----------
async function sendKey(key) {
  if (!config.host) throw new Error('Nenhuma TV configurada');
  if (config.type === 'roku') {
    const k = ROKU_KEYS[key]; if (!k) throw new Error('Tecla desconhecida: ' + key);
    return rokuPost(config.host, '/keypress/' + k);
  }
  if (config.type === 'android') {
    if (atvState !== 'ready') throw new Error('TV ainda não conectada/pareada');
    const k = ANDROID_KEYS[key]; if (!k) throw new Error('Tecla desconhecida: ' + key);
    return atv.sendKey(K[k], D.SHORT);
  }
  throw new Error('Tipo de TV não configurado');
}

async function openApp(name) {
  const app = APPS[name]; if (!app) throw new Error('App desconhecido');
  if (config.type === 'roku') {
    if (!app.roku) throw new Error('App indisponível no Roku');
    return rokuPost(config.host, '/launch/' + app.roku);
  }
  if (config.type === 'android' && atvState === 'ready') return atv.sendAppLink(app.android);
  throw new Error('TV não conectada');
}

// ---------- descoberta (varredura da sub-rede) ----------
const probe = (host, port, ms = 500) => new Promise((resolve) => {
  const s = net.connect({ host, port, timeout: ms });
  s.on('connect', () => { s.destroy(); resolve(true); });
  s.on('timeout', () => { s.destroy(); resolve(false); });
  s.on('error', () => resolve(false));
});

async function discover() {
  const bases = new Set();
  for (const i of ifaces()) bases.add(i.address.split('.').slice(0, 3).join('.'));
  const found = [];
  const jobs = [];
  for (const b of bases) for (let n = 1; n < 255; n++) {
    const host = `${b}.${n}`;
    jobs.push((async () => {
      if (await probe(host, 8060)) found.push({ host, type: 'roku' });
      else if (await probe(host, 6466)) found.push({ host, type: 'android' });
    })());
  }
  await Promise.all(jobs);
  return found;
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const readBody = (req) => new Promise((res) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch { res({}); } }); });
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const status = () => ({
  type: config.type, host: config.host,
  state: config.type === 'android' ? atvState : (config.host ? 'ready' : 'idle'),
  error: atvError, apps: Object.keys(APPS),
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/status') return json(res, 200, status());
    if (url.pathname === '/api/discover') return json(res, 200, await discover());
    if (req.method === 'POST' && url.pathname === '/api/connect') {
      const { type, host } = await readBody(req);
      if (!['roku', 'android'].includes(type) || !/^[\d.]{7,15}$/.test(host || '')) return json(res, 400, { error: 'Tipo ou IP inválido' });
      if (config.host !== host || config.type !== type) config.cert = null;
      config.type = type; config.host = host; saveConfig();
      stopAtv();
      if (type === 'android') startAtv();
      return json(res, 200, status());
    }
    if (req.method === 'POST' && url.pathname === '/api/pair') {
      const { code } = await readBody(req);
      if (!atv || atvState !== 'pairing') return json(res, 400, { error: 'Nenhum pareamento em andamento' });
      await atv.sendCode(String(code || '').trim().toUpperCase());
      return json(res, 200, status());
    }
    if (req.method === 'POST' && url.pathname === '/api/key') { await sendKey((await readBody(req)).key); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/api/app') { await openApp((await readBody(req)).app); return json(res, 200, { ok: true }); }

    // arquivos estáticos
    const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    json(res, 500, { error: e.message || String(e) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Controle TCL rodando. Abra no navegador (mesmo Wi-Fi da TV):');
  console.log(`  http://localhost:${PORT}   (neste aparelho)`);
  ifaces().forEach((i) => console.log(`  http://${i.address}:${PORT}   (outros aparelhos na rede)`));
  if (config.type === 'android' && config.host) startAtv();
});
