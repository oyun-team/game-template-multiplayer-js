// Checks game.json and the game folder before publishing. Run locally with: node scripts/check.mjs
// game.json ve oyun klasörünü kontrol eder. Bilgisayarında çalıştırmak için: node scripts/check.mjs
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CATEGORIES = ["arcade", "puzzle", "action", "adventure", "strategy", "sports", "racing", "board", "educational", "other"];
const AGES = [3, 7, 12, 16, 18];
const SKILLS = ["focus", "reflexes", "timing", "rhythm", "coordination", "spatial", "memory", "planning", "strategy", "logic", "patience"];
const UNITS = ["ms", "percent", "count", "level"];
// The measure catalog (MEASURING.md): a catalog id means the same in every game. [skill, unit, better]
const CATALOG = {
  reaction_ms: ["reflexes", "ms", "lower"],
  hit_rate: ["focus", "percent", "higher"],
  avoid_rate: ["focus", "percent", "higher"],
  tap_accuracy: ["coordination", "percent", "higher"],
  catch_rate: ["coordination", "percent", "higher"],
  lives_lost: ["coordination", "count", "lower"],
  timing_accuracy: ["timing", "percent", "higher"],
  beat_error_ms: ["rhythm", "ms", "lower"],
  placement_accuracy: ["spatial", "percent", "higher"],
  memory_span: ["memory", "count", "higher"],
  extra_moves: ["planning", "count", "lower"],
  retries: ["planning", "count", "lower"],
  win_rate: ["strategy", "percent", "higher"],
  blunders: ["strategy", "count", "lower"],
  solve_ms: ["logic", "ms", "lower"],
  early_actions: ["patience", "count", "lower"],
};
const MAX_MEASURES = 3;
const MAX_MB = 60;
const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

let game;
try {
  game = JSON.parse(readFileSync("game.json", "utf8"));
} catch (err) {
  console.error(`✗ game.json okunamadı / could not be read: ${err.message}`);
  process.exit(1);
}

if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(game.slug ?? "")) {
  fail('slug: 3-40 küçük harf, rakam veya tire / lowercase letters, digits, dashes (örn. "balon-patlat")');
}
if (game.slug === "ornek-renk-kapmaca") fail('slug: örnek oyunun slug\'ını kendi oyununun adıyla değiştir / change the example slug to your own');
if (!game.title?.tr || game.title.tr.length > 60) fail("title.tr gerekli, en fazla 60 karakter / required, max 60 chars");
if (game.title?.en && game.title.en.length > 60) fail("title.en en fazla 60 karakter / max 60 chars");
if (!game.author || game.author.length > 40) fail("author gerekli, en fazla 40 karakter / required, max 40 chars");
if (game.author === "takma-adin") fail('author: "takma-adin" yerine kendi takma adını yaz / put your own nickname');
if (!CATEGORIES.includes(game.category ?? "other")) fail(`category: ${CATEGORIES.join(", ")}`);
if (!["portrait", "landscape", "any"].includes(game.orientation ?? "any")) fail("orientation: portrait, landscape, any");
if (game.age !== undefined && !AGES.includes(game.age)) fail(`age: ${AGES.join(", ")} (önerilen en küçük yaş / recommended minimum age)`);
for (const field of ["audience", "benefits"]) {
  const v = game[field];
  if (v === undefined) continue;
  if (!v || typeof v !== "object" || Array.isArray(v)) fail(`${field}: { "tr": "...", "en": "..." }`);
  else for (const l of ["tr", "en"]) if (v[l] !== undefined && (typeof v[l] !== "string" || v[l].length > 300)) fail(`${field}.${l}: en fazla 300 karakter / max 300 chars`);
}
if (game.skills !== undefined && !(Array.isArray(game.skills) && game.skills.length <= 4 && new Set(game.skills).size === game.skills.length && game.skills.every((s) => SKILLS.includes(s)))) {
  fail(`skills: en fazla 4, tekrarsız / up to 4, no repeats: ${SKILLS.join(", ")}`);
}
// measures: what the game measures for the parent's progress view (see README, "Measuring").
if (game.measures === undefined) {
  warnings.push('measures: yok; aile sayfası sadece oyun süresini gösterir / none; parents will only see play time (MEASURING.md)');
} else if (!Array.isArray(game.measures) || game.measures.length < 1 || game.measures.length > MAX_MEASURES) {
  fail(`measures: 1-${MAX_MEASURES} ölçüm listesi / a list of 1-${MAX_MEASURES} measures`);
} else {
  const ids = new Set();
  game.measures.forEach((m, i) => {
    const at = `measures[${i}]`;
    if (!m || typeof m !== "object") return fail(`${at}: { "id", "skill", "unit", "better", "label" }`);
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(m.id ?? "")) fail(`${at}.id: küçük harf, rakam, _ / lowercase letters, digits, _ (örn. "reaction_ms")`);
    else if (ids.has(m.id)) fail(`${at}.id: "${m.id}" iki kez var / used twice`);
    ids.add(m.id);
    if (!SKILLS.includes(m.skill)) fail(`${at}.skill: ${SKILLS.join(", ")}`);
    else if (Array.isArray(game.skills) && !game.skills.includes(m.skill)) fail(`${at}.skill: "${m.skill}" skills listesinde de olmalı / must also be in skills`);
    if (!UNITS.includes(m.unit)) fail(`${at}.unit: ${UNITS.join(", ")}`);
    if (!["higher", "lower"].includes(m.better)) fail(`${at}.better: "higher" veya / or "lower"`);
    if (!m.label?.tr || m.label.tr.length > 40) fail(`${at}.label.tr gerekli, en fazla 40 karakter / required, max 40 chars`);
    const known = CATALOG[m.id];
    if (known && (m.skill !== known[0] || m.unit !== known[1] || m.better !== known[2])) {
      fail(`${at}: "${m.id}" katalogda / is in the catalog: "skill": "${known[0]}", "unit": "${known[1]}", "better": "${known[2]}" (MEASURING.md)`);
    } else if (!known && ids.size && /^[a-z]/.test(m.id ?? "")) {
      warnings.push(`${at}.id: "${m.id}" katalogda yok; sadece bu oyunun grafiğinde görünür / not in the catalog; shown only on this game's own chart (MEASURING.md)`);
    }
    if (m.label?.en && m.label.en.length > 40) fail(`${at}.label.en en fazla 40 karakter / max 40 chars`);
  });
}
if (game.languages && !(Array.isArray(game.languages) && game.languages.length && game.languages.every((l) => l === "tr" || l === "en"))) {
  fail('languages: ["tr"], ["en"] veya / or ["tr", "en"]');
}

// multiplayer: how the game is played online (README, "Çok oyunculu / Multiplayer"). Same rules as the site.
const MODES = ["pvp", "pve", "pvc"];
function teamsOf(f) {
  if (typeof f !== "string") return null;
  const coop = /^coop([1-9]|10)$/.exec(f);
  if (coop) return [Number(coop[1])];
  if (!/^([1-9]|10)(v([1-9]|10))+$/.test(f)) return null;
  const teams = f.split("v").map(Number);
  return teams.length <= 10 && teams.reduce((a, b) => a + b, 0) <= 20 ? teams : null;
}
const mp = game.multiplayer;
if (mp === undefined) {
  fail('multiplayer: bu şablon çok oyunculu oyunlar için / this template is for multiplayer games (README)');
} else if (!mp || typeof mp !== "object" || Array.isArray(mp)) {
  fail('multiplayer: { "room", "modes", "formats", "bots" }');
} else {
  if ((mp.room ?? "relay") !== "relay") fail('multiplayer.room: "relay"');
  const modes = mp.modes;
  if (!Array.isArray(modes) || !modes.length || new Set(modes).size !== modes.length || !modes.every((m) => MODES.includes(m))) {
    fail(`multiplayer.modes: ${MODES.join(", ")} (pvp: birbirinize karşı / against each other, pve: birlikte oyuna karşı / together against the game, pvc: bilgisayara karşı / against the computer)`);
  }
  const formats = mp.formats;
  if (!Array.isArray(formats) || !formats.length || formats.length > 6 || new Set(formats).size !== formats.length) {
    fail('multiplayer.formats: 1-6 takım düzeni / 1-6 formats, örn. / e.g. "1v1", "2v2", "1v1v1", "coop4"');
  } else {
    for (const f of formats) {
      const teams = teamsOf(f);
      if (!teams) fail(`multiplayer.formats: "${f}" geçersiz / not valid (takım başına 1-10, en fazla 20 oyuncu / 1-10 per team, max 20 players; "coop2"-"coop10")`);
      else if (Array.isArray(modes) && !modes.some((m) => (m === "pve" ? teams.length === 1 : teams.length >= 2))) {
        fail(`multiplayer.formats: "${f}" hiçbir mode'a uymuyor / fits no mode (coop: pve; takımlar / teams: pvp, pvc)`);
      }
    }
  }
  if (mp.bots !== undefined && typeof mp.bots !== "boolean") fail("multiplayer.bots: true / false");
  if (Array.isArray(modes) && modes.includes("pvc") && mp.bots !== true) fail('multiplayer.bots: "pvc" için true olmalı / must be true for "pvc"');
  const wait = mp.matchWaitSeconds ?? 20;
  if (!Number.isInteger(wait) || wait < 5 || wait > 120) fail("multiplayer.matchWaitSeconds: 5-120");
}

const dir = game.dir || "game";
if (!existsSync(join(dir, "index.html"))) fail(`${dir}/index.html bulunamadı / not found`);
else if (!/oyun-mp\.js/.test(readFileSync(join(dir, "index.html"), "utf8"))) fail(`${dir}/index.html: oyun-mp.js yüklenmeli / must load oyun-mp.js (oyun-sdk.js'den sonra / after oyun-sdk.js)`);
if (game.thumbnail && !existsSync(join(dir, game.thumbnail))) fail(`thumbnail ${dir}/${game.thumbnail} bulunamadı / not found`);

function size(path) {
  const s = statSync(path);
  if (!s.isDirectory()) return s.size;
  return readdirSync(path).reduce((sum, name) => sum + size(join(path, name)), 0);
}
if (existsSync(dir) && size(dir) > MAX_MB * 1024 * 1024) fail(`${dir} klasörü ${MAX_MB} MB'tan büyük / larger than ${MAX_MB} MB`);

if (errors.length) {
  console.error("✗ game.json kontrolü başarısız / check failed:");
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
warnings.forEach((w) => console.warn("! " + w));
console.log(`✓ ${game.slug} hazır / ready (${dir}/)`);
