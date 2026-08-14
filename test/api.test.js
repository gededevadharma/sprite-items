/**
 * Unit test for the pure logic in the worker: items.dat.txt parsing and
 * icon coordinate math. No framework — `node --test`.
 *
 * Downloads items.dat.txt from the real source (same URL the Worker uses)
 * and caches it in OS temp, so this runs anywhere without wrangler.
 */
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_URL = new URL("../src/worker.mjs.js", import.meta.url);

const VERSION = process.env.GT_VER || "5.45.";
const CACHE = path.join(os.tmpdir(), `growtools-items-${VERSION}.txt`);

function getItemsDatTxt() {
  if (!fs.existsSync(CACHE)) {
    const url = `https://raw.githubusercontent.com/kabuokis/growtopia-data/main/${VERSION}/decoded/items.dat.txt`;
    const tmp = CACHE + ".part";
    execFileSync("curl", ["-sS", "-L", "-o", tmp, url], { stdio: "inherit" });
    fs.renameSync(tmp, CACHE);
  }
  return fs.readFileSync(CACHE, "utf8");
}

function load() {
  return import(MODULE_URL);
}

test("Dirt (id 2) parses to correct texture + coords", async () => {
  const { findItem } = await load();
  const item = findItem(getItemsDatTxt(), 2);
  assert.ok(item, "item 2 found");
  assert.strictEqual(item.name, "Dirt");
  assert.strictEqual(item.file_name, "tiles_page1.rttex");
  assert.strictEqual(item.tex_x, 8);
  assert.strictEqual(item.tex_y, 20);
  assert.strictEqual(item.storage_type, 2);
});

test("seed item (id 1, Blank Seed) flagged correctly", async () => {
  const { findItem, isSeed } = await load();
  const item = findItem(getItemsDatTxt(), 1);
  assert.ok(item, "item 1 found");
  assert.ok(item.bloom_time !== 0);
  assert.strictEqual(isSeed(item), true);
});

test("pngName maps rttex → png and player_* → _icon.png", async () => {
  const { pngName } = await load();
  assert.strictEqual(pngName("tiles_page1.rttex"), "tiles_page1.png");
  assert.strictEqual(pngName("seed.png"), "seed.png");
  assert.strictEqual(pngName("player_handitem.rttex"), "player_handitem_icon.png");
  assert.strictEqual(pngName(null), null);
});

test("iconCoordinates applies spread_type offsets", async () => {
  const { iconCoordinates } = await load();
  const base = { tex_x: 8, tex_y: 20 };
  assert.deepStrictEqual(iconCoordinates({ ...base, storage_type: 2 }), [12, 21]);
  assert.deepStrictEqual(iconCoordinates({ ...base, storage_type: 5 }), [12, 21]);
  assert.deepStrictEqual(iconCoordinates({ ...base, storage_type: 3 }), [11, 20]);
  assert.deepStrictEqual(iconCoordinates({ ...base, storage_type: 0 }), [8, 20]);
  assert.deepStrictEqual(iconCoordinates({ tex_x: 0, tex_y: 0 }), [0, 0]);
});

test("missing id returns null", async () => {
  const { findItem } = await load();
  assert.strictEqual(findItem(getItemsDatTxt(), 999999), null);
});