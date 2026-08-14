/**
 * Growtools Item Icon API — Cloudflare Worker (pure ESM)
 * -------------------------------------------------
 * Serves an item sprite (PNG) from the growtopia-data repo.
 *
 *   /icon?id=2                              Dirt icon, latest version
 *   /icon?id=2&v=5.42                       Dirt icon at a specific version
 *   /icon?file=seed.png&x=0&y=0             Direct crop of a texture
 *
 * Item rows come from items.dat.txt (plain text, same data the Growtools
 * app shows). Textures come from raw.githubusercontent.com. Cropping is
 * done in pure JS with fast-png — no canvas, no createImageBitmap — so it
 * runs on Cloudflare Workers' standard runtime.
 */
import { decode, encode } from "fast-png";

const BASE = "https://raw.githubusercontent.com/kabuokis/growtopia-data/main";
const TILE = 32;
const VERSION_RE = /^\d+(\.\d+)*\.?$/;
// DEFAULT_VERSION can be injected via wrangler [vars]; this is the fallback.
const DEFAULT_VERSION = globalThis.DEFAULT_VERSION || "5.45.";

const HEADERS = {
  "content-type": "image/png",
  "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
  "access-control-allow-origin": "*",
};

function json(body, status = 400) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

/* ---------- items.dat.txt parsing ----------
 * Each line: `id | properties | type | ... | name | file_name | ...`.
 * Column indices come from the header (see items.dat.txt, line 1).
 */
const TXT_COLS = {
  id: 0, type: 2, name: 4, file_name: 5,
  tex_x: 9, tex_y: 10, spread_type: 11, clothing_type: 16,
  bg_col: 30, fg_col: 31, seed1: 32, seed2: 33, bloom_time: 34,
};

function n(v) { const x = parseInt(v, 10); return isNaN(x) ? 0 : x; }

/**
 * Parses items.dat.txt plain text and returns the row whose `id` matches,
 * or null. Skips the header line and any line without a numeric first field.
 */
function parseTxt(txt, targetId) {
  for (const raw of txt.split("\n")) {
    const line = raw.trim();
    if (!line || /^id\s*\|/.test(line)) continue;
    const p = line.split("|").map((s) => s.trim());
    if (p.length < 34 || isNaN(+p[0])) continue;
    if (n(p[TXT_COLS.id]) !== targetId) continue;
    return {
      id: n(p[TXT_COLS.id]),
      type: n(p[TXT_COLS.type]),
      name: p[TXT_COLS.name] || "",
      file_name: p[TXT_COLS.file_name] || "",
      tex_x: n(p[TXT_COLS.tex_x]),
      tex_y: n(p[TXT_COLS.tex_y]),
      storage_type: n(p[TXT_COLS.spread_type]),
      clothing_type: n(p[TXT_COLS.clothing_type]),
      bg_col: n(p[TXT_COLS.bg_col]),
      fg_col: n(p[TXT_COLS.fg_col]),
      seed1: n(p[TXT_COLS.seed1]),
      seed2: n(p[TXT_COLS.seed2]),
      bloom_time: n(p[TXT_COLS.bloom_time]),
      seed_base: 0, seed_over: 0,
    };
  }
  return null;
}
const findItem = parseTxt;

/* ---------- icon logic ---------- */

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

function decodeGTColor(value) {
  const num = (value || 0) >>> 0;
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  if ((num & 0xff) === 0) return [r, g, b];
  return [(num >> 8) & 0xff, (num >> 16) & 0xff, (num >> 24) & 0xff];
}

function isSeed(item) {
  return item.type !== 38 && (item.bloom_time || 0) !== 0;
}

/** Decodes a PNG response body into { width, height, data(RGBA) }. */
async function decodePngFromUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`texture ${resp.status}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  return decode(buf);
}

/**
 * Crops a WxH region starting at (sx,sy) tiles of 32px from a texture PNG
 * and returns a new PNG buffer. Pure data-level crop — no canvas.
 */
async function cropTile(url, sx, sy, size = TILE) {
  const img = await decodePngFromUrl(url);
  const rowBytes = img.width * 4;
  const out = new Uint8ClampedArray(size * size * 4);
  const ox = sx * size;
  const oy = sy * size;
  if (oy + size > img.height || ox + size > img.width) {
    throw new Error(`crop (${ox},${oy}) outside ${img.width}x${img.height}`);
  }
  for (let row = 0; row < size; row++) {
    const src = ((oy + row) * img.width + ox) * 4;
    out.set(img.data.subarray(src, src + size * 4), row * size * 4);
  }
  return encode({ width: size, height: size, data: out });
}

/**
 * Renders a seed item from seed.png + bg/fg colors, mirroring
 * drawSeedBadge() in the Growtools app.
 */
async function seedIcon(item, version) {
  const seed = await decodePngFromUrl(`${BASE}/${version}/decoded/textures/seed.png`);
  const size = TILE;
  const out = new Uint8ClampedArray(size * size * 4); // start transparent

  const baseSlot = item.seed_base ?? item.seed1 ?? 0;
  const overSlot = item.seed_over ?? item.seed2 ?? 0;
  const bg = decodeGTColor(item.bg_col || 0);
  const fg = decodeGTColor(item.fg_col || 0);
  const ok = (c) => c[0] > 10 || c[1] > 10 || c[2] > 10;

  const layer = (slot, row, color, fallback) => {
    const c = ok(color) ? color : fallback;
    const sx = (slot % 16) * 16;
    const sy = row * 16;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const si = ((sy + y) * seed.width + sx + x) * 4;
        const a = seed.data[si + 3];
        if (a === 0) continue;
        const t = (seed.data[si] / 255) * 0.9;
        const oi = (y * size + x) * 4;
        out[oi] = Math.round(c[0] * t);
        out[oi + 1] = Math.round(c[1] * t);
        out[oi + 2] = Math.round(c[2] * t);
        out[oi + 3] = a;
      }
    }
  };

  layer(baseSlot, 0, bg, [160, 180, 80]);
  layer(overSlot, 1, fg, [60, 80, 40]);
  return encode({ width: size, height: size, data: out });
}

/* ---------- request handling ---------- */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/") {
      return json({
        endpoints: {
          "/icon?id=2": "item icon by Growtopia item id",
          "/icon?id=2&v=5.42": "item icon at a specific data version",
          "/icon?file=seed.png&x=0&y=0": "direct texture crop",
        },
        texture_base: `${BASE}/<version>/decoded/textures/`,
      });
    }

    if (pathname !== "/icon") return json({ error: "not found" }, 404);

    const version = (url.searchParams.get("v") || DEFAULT_VERSION).trim();
    if (!VERSION_RE.test(version)) return json({ error: `bad version "${version}"` });

    // Direct crop mode: /icon?file=tiles_page1.png&x=384&y=672
    const file = url.searchParams.get("file");
    if (file) {
      let x = parseInt(url.searchParams.get("x"), 10);
      let y = parseInt(url.searchParams.get("y"), 10);
      if (!isFinite(x)) x = 0;
      if (!isFinite(y)) y = 0;
      const png = pngName(file);
      if (!png) return json({ error: `bad file "${file}"` });
      try {
        const buf = await cropTile(`${BASE}/${version}/decoded/textures/${png}`, x, y);
        return new Response(buf, { headers: HEADERS });
      } catch (e) {
        return json({ error: e.message }, 502);
      }
    }

    // Item id mode: /icon?id=2
    const idParam = url.searchParams.get("id");
    if (idParam == null) return json({ error: "missing ?id=" });
    const id = parseInt(idParam, 10);
    if (!isFinite(id) || id < 0) return json({ error: `bad id "${idParam}"` });

    try {
      const datResp = await fetch(`${BASE}/${version}/decoded/items.dat.txt`);
      if (!datResp.ok) return json({ error: `items.dat.txt for v${version}: HTTP ${datResp.status}` }, 502);
      const item = findItem(await datResp.text(), id);
      if (!item) return json({ error: `item ${id} not found in v${version}` }, 404);

      if (!item.file_name) return json({ error: `item ${id} has no texture` }, 404);

      const png = pngName(item.file_name);
      if (!png) return json({ error: `item ${id} has unreadable texture "${item.file_name}"` }, 404);

      if (isSeed(item)) {
        const buf = await seedIcon(item, version);
        return new Response(buf, { headers: HEADERS });
      }

      const [sx, sy] = iconCoordinates(item);
      const buf = await cropTile(`${BASE}/${version}/decoded/textures/${png}`, sx, sy);
      return new Response(buf, { headers: HEADERS });
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  },
};

export { findItem, pngName, iconCoordinates, cropTile, seedIcon, decodeGTColor, isSeed };
