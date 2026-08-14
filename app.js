// Sprite Items Icon — GitHub Pages static app.
// Fetches items.dat.txt + sprite textures from kabuokis/growtopia-data and
// crops 32x32 item icons on canvas in the browser (same logic as the
// Growtools ItemBrowser). No build step, no server.
"use strict";

const BASE = "https://raw.githubusercontent.com/kabuokis/growtopia-data/main";
const TILE = 32;
const DEFAULT_VERSION = "5.45.";

const $ = (s) => document.querySelector(s);

const TXT_COLS = {
  id: 0, type: 2, name: 4, file_name: 5,
  tex_x: 9, tex_y: 10, spread_type: 11, clothing_type: 16,
  bg_col: 30, fg_col: 31, seed1: 32, seed2: 33, bloom_time: 34,
};

const imgCache = new Map(); // url -> HTMLImageElement

async function loadImage(url) {
  if (imgCache.has(url)) return imgCache.get(url);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  const p = new Promise((res, rej) => {
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`gagal memuat ${url}`));
  });
  img.src = url;
  imgCache.set(url, img);
  return p;
}

function pngName(fn) {
  if (!fn) return null;
  if (fn.toLowerCase().endsWith(".png")) return fn;
  const b = fn.replace(/\.rttex$/i, "");
  if (/^player_(feet|handitem|longhanditem|cosmetics)/i.test(b)) return b + "_icon.png";
  return b + ".png";
}

function iconCoordinates(item) {
  const x = item.tex_x ?? 0;
  const y = item.tex_y ?? 0;
  const spread = item.storage_type ?? 0;
  if (spread === 2 || spread === 5) return [x + 4, y + 1];
  if (spread === 3) return [x + 3, y];
  return [x, y];
}

function decodeGTColor(v) {
  const num = (v || 0) >>> 0;
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  if ((num & 0xff) === 0) return [r, g, b];
  return [(num >> 8) & 0xff, (num >> 16) & 0xff, (num >> 24) & 0xff];
}

function isSeed(item) {
  return item.type !== 38 && (item.bloom_time || 0) !== 0;
}

const n = (v) => { const x = parseInt(v, 10); return isNaN(x) ? 0 : x; };

function parseItemsTxt(txt) {
  const out = [];
  for (const raw of txt.split("\n")) {
    const line = raw.trim();
    if (!line || /^id\s*\|/.test(line)) continue;
    const p = line.split("|").map((s) => s.trim());
    if (p.length < 34 || isNaN(+p[0])) continue;
    out.push({
      id: n(p[TXT_COLS.id]), type: n(p[TXT_COLS.type]),
      name: p[TXT_COLS.name] || "", file_name: p[TXT_COLS.file_name] || "",
      tex_x: n(p[TXT_COLS.tex_x]), tex_y: n(p[TXT_COLS.tex_y]),
      storage_type: n(p[TXT_COLS.spread_type]), clothing_type: n(p[TXT_COLS.clothing_type]),
      bg_col: n(p[TXT_COLS.bg_col]), fg_col: n(p[TXT_COLS.fg_col]),
      seed1: n(p[TXT_COLS.seed1]), seed2: n(p[TXT_COLS.seed2]),
      bloom_time: n(p[TXT_COLS.bloom_time]),
    });
  }
  return out.filter((it) => it.name && it.file_name);
}

async function fetchVersions() {
  const r = await fetch("https://api.github.com/repos/kabuokis/growtopia-data/contents/");
  if (!r.ok) throw new Error("gagal ambil daftar versi");
  const entries = await r.json();
  return entries.filter((e) => e.type === "dir" && /^\d/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pb[i] || 0) - (pa[i] || 0);
        if (d) return d;
      }
      return 0;
    });
}

// ---- icon drawing ---------------------------------------------------

function drawSeedBadge(canvas, item, size, seedImg) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  const baseSlot = item.seed1 || 0;
  const overSlot = item.seed2 || 0;
  const bg = decodeGTColor(item.bg_col || 0);
  const fg = decodeGTColor(item.fg_col || 0);
  const ok = (c) => c[0] > 10 || c[1] > 10 || c[2] > 10;

  const layer = (slot, row, color, fallback) => {
    const c = ok(color) ? color : fallback;
    const lc = document.createElement("canvas");
    lc.width = 16; lc.height = 16;
    const lctx = lc.getContext("2d");
    lctx.imageSmoothingEnabled = false;
    lctx.drawImage(seedImg, (slot % 16) * 16, row * 16, 16, 16, 0, 0, 16, 16);
    const id = lctx.getImageData(0, 0, 16, 16);
    for (let i = 0; i < id.data.length; i += 4) {
      if (id.data[i + 3] === 0) continue;
      const t = (id.data[i] / 255) * 0.9;
      id.data[i] = Math.round(c[0] * t);
      id.data[i + 1] = Math.round(c[1] * t);
      id.data[i + 2] = Math.round(c[2] * t);
    }
    lctx.putImageData(id, 0, 0);
    ctx.drawImage(lc, 0, 0, 16, 16, 0, 0, size, size);
  };

  layer(baseSlot, 0, bg, [160, 180, 80]);
  layer(overSlot, 1, fg, [60, 80, 40]);
}

async function drawItemInto(canvas, item, version, smooth = false) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = smooth; // smooth upscale utk mode raw besar
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  try {
    if (isSeed(item)) {
      const seed = await loadImage(`${BASE}/${version}/decoded/textures/seed.png`);
      drawSeedBadge(canvas, item, canvas.width, seed);
      return;
    }
    const p = pngName(item.file_name);
    const img = await loadImage(`${BASE}/${version}/decoded/textures/${p}`);
    let sx = item.tex_x, sy = item.tex_y;
    const fn = item.file_name.toLowerCase();
    if (/^player_(feet|handitem|longhanditem|cosmetics)/.test(fn)) {
      sy = fn.includes("player_feet") ? sy * 2 : sy; // feet icon uses 2x row
    } else {
      [sx, sy] = iconCoordinates(item);
    }
    ctx.drawImage(img, sx * TILE, sy * TILE, TILE, TILE, 0, 0, canvas.width, canvas.height);
  } catch (e) {
    ctx.fillStyle = "#666"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff"; ctx.font = "10px monospace";
    ctx.fillText("ERR", 4, canvas.height / 2);
  }
}

// ---- app state ------------------------------------------------------

let items = [];
let version = DEFAULT_VERSION;
const DEFAULT_PAGE = 96;

async function loadItems() {
  const r = await fetch(`${BASE}/${version}/decoded/items.dat.txt`);
  if (!r.ok) throw new Error(`items.dat.txt HTTP ${r.status}`);
  items = parseItemsTxt(await r.text());
  render();
}

function filtered() {
  const q = $("#search").value.trim().toLowerCase();
  if (!q) return items.slice(0, DEFAULT_PAGE);
  return items.filter((it) =>
    it.name.toLowerCase().includes(q) || it.id.toString().includes(q)
  ).slice(0, DEFAULT_PAGE);
}

let renderToken = 0;
function render() {
  renderToken++;
  const token = renderToken;
  const grid = $("#grid");
  grid.innerHTML = "";
  const list = filtered();
  $("#status").textContent = `${items.length} item • menampilkan ${list.length}`;

  for (const item of list) {
    const cell = document.createElement("div");
    cell.className = "cell";
    const cv = document.createElement("canvas");
    cv.width = 48; cv.height = 48;
    const nm = document.createElement("div");
    nm.className = "nm"; nm.textContent = item.name;
    nm.title = item.name;
    const idEl = document.createElement("div");
    idEl.className = "id"; idEl.textContent = `#${item.id}`;
    cell.append(cv, nm, idEl);
    cell.addEventListener("click", () => showModal(item));
    grid.appendChild(cell);

    drawItemInto(cv, item, version).catch(() => {});
  }
}

function showModal(item) {
  const dlg = $("#dlg");
  $("#dlgName").textContent = item.name;
  $("#dlgId").textContent = `ID ${item.id} • type ${item.type}`;
  $("#bigInfo").innerHTML =
    `Texture: <span class="code">${item.file_name}</span><br>` +
    `tex: <span class="code">${item.tex_x},${item.tex_y}</span> • ` +
    `spread: <span class="code">${item.storage_type}</span><br>` +
    `Seed: <span class="code">${isSeed(item) ? "ya" : "tidak"}</span>`;
  drawItemInto($("#bigCanvas"), item, version).catch(() => {});
  dlg.$item = item;
  dlg.showModal();
}

$("#btnDl").addEventListener("click", () => {
  const it = $("#dlg").$item;
  if (!it) return;
  const cv = document.createElement("canvas");
  cv.width = 32; cv.height = 32;
  drawItemInto(cv, it, version).catch(() => {}).then(() => {
    setTimeout(() => {
      const a = document.createElement("a");
      a.download = `${it.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${it.id}.png`;
      a.href = cv.toDataURL("image/png");
      a.click();
    }, 50);
  });
});

$("#btnCopy").addEventListener("click", () => {
  const it = $("#dlg").$item;
  if (!it) return;
  const url = `${location.origin}${location.pathname}?id=${it.id}&v=${version}`;
  navigator.clipboard?.writeText(url).then(() => alert("URL disalin!"));
});

$("#search").addEventListener("input", render);
$("#verSelect").addEventListener("change", async () => {
  version = $("#verSelect").value;
  $("#status").textContent = "Memuat item...";
  try { await loadItems(); } catch (e) { $("#status").textContent = e.message; }
});

// ---- init -----------------------------------------------------------

async function init() {
  try {
    const vers = await fetchVersions();
    const sel = $("#verSelect");
    for (const v of vers) {
      const opt = document.createElement("option");
      opt.value = v; opt.textContent = v + (v === DEFAULT_VERSION ? " (default)" : "");
      sel.append(opt);
    }
    if (!vers.includes(DEFAULT_VERSION) && vers.length) version = vers[0];
    sel.value = version;
    await loadItems();
    $("#btnLoad").disabled = false;
  } catch (e) {
    $("#status").textContent = "Gagal memuat: " + e.message;
  }
}

// If the page was opened with ?id=..., open that item once loaded.
function handleDeepLink() {
  const q = new URLSearchParams(location.search);
  const id = q.get("id");
  if (!id) return;
  const item = items.find((it) => it.id === parseInt(id, 10));
  if (item) showModal(item);
}

// "Gambar saja": `?id=7188&raw=1` -> halaman berisi hanya ikon item besar,
// cocok dipakai sebagai URL `<img>` / embed. Menghilangkan header + grid.
function renderRaw() {
  const q = new URLSearchParams(location.search);
  const id = parseInt(q.get("id"), 10);
  if (!isFinite(id)) return;
  const item = items.find((it) => it.id === id);
  if (!item) { $("#status").textContent = `Item ${id} tidak ditemukan`; return; }

  document.querySelector("header").style.display = "none";
  $("#grid").style.display = "none";
  document.body.style.margin = "0";
  document.body.style.background = "transparent";

  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;align-items:center;justify-content:center;min-height:100vh;";
  // Default 1024x1024 (supersample dari sprite 32px). Bisa dioverride &size=.
  const size = parseInt(q.get("size"), 10) || 1024;
  const cv = document.createElement("canvas");
  cv.width = size; cv.height = size;
  cv.style.cssText = "image-rendering:pixelated;width:" + size + "px;height:" + size + "px;background:repeating-conic-gradient(#2a3444 0 25%,#1e2736 0 50%) 0 0/" + (size / 64) + "px " + (size / 64) + "px;";
  wrap.appendChild(cv);
  document.body.appendChild(wrap);

  // Render ikon di canvas 32x32 dulu, lalu upscale mulus ke ukuran target.
  const small = document.createElement("canvas");
  small.width = 32; small.height = 32;
  drawItemInto(small, item, version).catch(() => {
    const sctx = small.getContext("2d");
    sctx.fillStyle = "#666"; sctx.fillRect(0, 0, 32, 32);
  }).then(() => {
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(small, 0, 0, 32, 32, 0, 0, size, size);
  });
}

init().then(() => {
  const q = new URLSearchParams(location.search);
  if (q.get("raw") === "1") renderRaw();
  else handleDeepLink();
});