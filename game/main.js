// Örnek oyun: Renk Kapmaca. Bu dosyayı kendi oyununla değiştir.
// Example game: Color Grab. Replace this file with your own game.
//
// How a multiplayer game works here (see README.md, "Multiplayer"):
// - One player's game is the HOST. Only the host moves pieces, runs computer players and decides
//   who won. It sends the whole game state to everyone else several times a second.
// - The other games only draw the last state they got and send their taps to the host.
// - If the host leaves, another player becomes host and carries on from the last state it saw.

const TEXT = {
  tr: { wait: "Oyun kurucusu bekleniyor…", time: "Süre", help: "Gitmek istediğin kareye dokun", you: "sen", over: "Bitti!" },
  en: { wait: "Waiting for the host…", time: "Time", help: "Tap the square you want to go to", you: "you", over: "Done!" },
};
const t = TEXT[OyunSDK.getLanguage()] || TEXT.tr;

const COLORS = ["#ff5d73", "#4cc9f0", "#ffb703", "#80ed99", "#c77dff", "#ff8fab", "#90e0ef", "#f4a261", "#b5e48c", "#e9c46a"];
const SIZE = 12;          // the board is SIZE x SIZE squares
const TICK_MS = 150;      // the host moves everyone one square per tick
const ROUND_TICKS = 400;  // 60 seconds
const SEND_EVERY = 1;     // ticks between state messages

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let W = 0, H = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// --- game state -----------------------------------------------------------------------------
// state = { ticks, grid: [team+1 or 0 per square], players: { id: { x, y, tx, ty, team, nick, bot } } }
let match = null;   // from OyunMP.onStart
let state = null;   // the host's live state, or the last one received
let prev = null;    // positions before the last state, to slide pieces smoothly
let gotAt = 0;
let timer = null;
let tickNo = 0;
let ended = false;

function newState(m) {
  const grid = new Array(SIZE * SIZE).fill(0);
  const players = {};
  // Start around the edge of the board, spread out.
  const spots = [[0, 0], [SIZE - 1, SIZE - 1], [SIZE - 1, 0], [0, SIZE - 1], [SIZE >> 1, 0], [SIZE >> 1, SIZE - 1], [0, SIZE >> 1], [SIZE - 1, SIZE >> 1], [3, 3], [SIZE - 4, SIZE - 4]];
  const order = m.players.slice().sort((a, b) => a.team - b.team || (a.id < b.id ? -1 : 1));
  // Teams take turns so team-mates don't start side by side.
  const byTeam = m.teams.map((_, team) => order.filter((p) => p.team === team));
  const seated = [];
  for (let i = 0; seated.length < order.length; i++) byTeam.forEach((list) => list[i] && seated.push(list[i]));
  seated.forEach((p, i) => {
    const [x, y] = spots[i % spots.length];
    players[p.id] = { x, y, tx: x, ty: y, team: p.team, nick: p.nick, bot: p.bot };
    grid[y * SIZE + x] = p.team + 1;
  });
  return { ticks: ROUND_TICKS, grid, players };
}

/** One step for every piece, computer players pick where to go, squares get painted. Host only. */
function step() {
  for (const p of Object.values(state.players)) {
    if (p.bot && (p.x === p.tx && p.y === p.ty || OyunMP.random() < 0.05)) pickBotTarget(p);
    const dx = Math.sign(p.tx - p.x);
    const dy = Math.sign(p.ty - p.y);
    if (Math.abs(p.tx - p.x) >= Math.abs(p.ty - p.y)) p.x += dx;
    else p.y += dy;
    state.grid[p.y * SIZE + p.x] = p.team + 1;
  }
  state.ticks--;
}

/** Computer players head for a nearby square that isn't their team's yet. */
function pickBotTarget(p) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(Math.random() * SIZE);
    const y = Math.floor(Math.random() * SIZE);
    if (state.grid[y * SIZE + x] === p.team + 1) continue;
    const d = Math.abs(x - p.x) + Math.abs(y - p.y);
    if (d < bestD) { best = [x, y]; bestD = d; }
  }
  if (best) [p.tx, p.ty] = best;
}

function counts() {
  const c = match.teams.map(() => 0);
  for (const v of state.grid) if (v) c[v - 1]++;
  return c;
}

/** places[team]: 1 for the most squares; equal counts share a place. */
function placesOf(c) {
  return c.map((n) => 1 + c.filter((m) => m > n).length);
}

function positions() {
  return state ? Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, { x: p.x, y: p.y }])) : null;
}

function hostTick() {
  if (!state || ended) return;
  const before = positions();
  step();
  tickNo++;
  if (tickNo % SEND_EVERY === 0) OyunMP.sendToAll({ k: "s", s: state });
  prev = before;
  gotAt = performance.now();
  if (state.ticks <= 0) {
    stopHost();
    OyunMP.end(placesOf(counts()));
  }
}

function startHost() {
  stopHost();
  timer = setInterval(hostTick, TICK_MS);
}
function stopHost() {
  if (timer) clearInterval(timer);
  timer = null;
}

function received(s) {
  prev = positions();
  state = s;
  gotAt = performance.now();
}

// --- multiplayer -----------------------------------------------------------------------------
OyunMP.onStart((m) => {
  match = m;
  ended = false;
  tickNo = 0;
  state = null;
  prev = null;
  if (m.isHost) {
    received(newState(m));
    startHost();
  }
});

OyunMP.onMessage((data, from) => {
  if (!data || ended) return;
  if (data.k === "s" && !OyunMP.isHost()) received(data.s);
  // A player tapped a square: only the host moves pieces.
  if (data.k === "go" && OyunMP.isHost() && state?.players[from]) {
    const p = state.players[from];
    p.tx = clamp(data.x);
    p.ty = clamp(data.y);
  }
});

OyunMP.onHostChange((isHost) => {
  // The old host left: the new one carries on from the last state everyone got.
  if (isHost && state && !ended) startHost();
});

OyunMP.onPlayerLeft((id) => {
  if (OyunMP.isHost() && state) delete state.players[id];
});

OyunMP.onEnd((places) => {
  ended = true;
  stopHost();
  // For the parent's progress view: did this player's team win? (game.json "measures")
  const me = match && match.players.find((p) => p.id === match.me);
  if (me) OyunSDK.measure("win_rate", places[me.team] === 1 ? 100 : 0);
});

const clamp = (v) => Math.max(0, Math.min(SIZE - 1, Math.floor(Number(v) || 0)));

// --- input -----------------------------------------------------------------------------------
function board() {
  const top = 54;
  const cell = Math.floor(Math.min((W - 16) / SIZE, (H - top - 40) / SIZE));
  return { cell, left: Math.floor((W - cell * SIZE) / 2), top };
}

function goTo(x, y) {
  if (!match || !state || ended) return;
  if (OyunMP.isHost()) {
    const p = state.players[match.me];
    if (p) { p.tx = x; p.ty = y; }
  } else {
    OyunMP.sendToHost({ k: "go", x, y });
  }
}

canvas.addEventListener("pointerdown", (e) => {
  const { cell, left, top } = board();
  const x = Math.floor((e.clientX - left) / cell);
  const y = Math.floor((e.clientY - top) / cell);
  if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) goTo(x, y);
});

window.addEventListener("keydown", (e) => {
  const p = state && match && state.players[match.me];
  if (!p) return;
  const dirs = { ArrowLeft: [-SIZE, 0], ArrowRight: [SIZE, 0], ArrowUp: [0, -SIZE], ArrowDown: [0, SIZE] };
  const d = dirs[e.key];
  if (!d) return;
  e.preventDefault();
  goTo(clamp(p.x + d[0]), clamp(p.y + d[1]));
});

// --- drawing ---------------------------------------------------------------------------------
function draw() {
  ctx.fillStyle = "#1b1730";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (!match || !state) {
    ctx.fillStyle = "#fff";
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.fillText(t.wait, W / 2, H / 2);
    return requestAnimationFrame(draw);
  }
  const { cell, left, top } = board();

  // Score bar: one block per team, as wide as its squares.
  const c = counts();
  const total = SIZE * SIZE;
  let x = 8;
  c.forEach((n, team) => {
    const w = ((W - 16) * n) / total;
    ctx.fillStyle = COLORS[team];
    ctx.fillRect(x, 8, w, 16);
    x += w;
  });
  ctx.fillStyle = "#fff";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.fillText(ended ? t.over : `${t.time}: ${Math.max(0, Math.ceil((state.ticks * TICK_MS) / 1000))}`, W / 2, 40);

  // Squares.
  for (let i = 0; i < state.grid.length; i++) {
    const gx = i % SIZE, gy = Math.floor(i / SIZE);
    ctx.fillStyle = state.grid[i] ? COLORS[state.grid[i] - 1] : "#2c2650";
    ctx.fillRect(left + gx * cell + 1, top + gy * cell + 1, cell - 2, cell - 2);
  }

  // Pieces, slid between the last two states.
  const k = Math.min(1, (performance.now() - gotAt) / TICK_MS);
  for (const [id, p] of Object.entries(state.players)) {
    const from = prev && prev[id] ? prev[id] : p;
    const px = left + (from.x + (p.x - from.x) * k + 0.5) * cell;
    const py = top + (from.y + (p.y - from.y) * k + 0.5) * cell;
    ctx.beginPath();
    ctx.arc(px, py, cell * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = id === match.me ? 5 : 3;
    ctx.strokeStyle = id === match.me ? "#1b1730" : COLORS[p.team];
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "600 11px system-ui, sans-serif";
    const label = id === match.me ? t.you : p.nick;
    const half = ctx.measureText(label).width / 2 + 4;
    ctx.fillText(label, Math.max(half, Math.min(W - half, px)), py - cell * 0.62);
  }

  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(t.help, W / 2, top + SIZE * cell + 20);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
