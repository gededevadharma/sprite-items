#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const BASE_URL = 'https://raw.githubusercontent.com/kabuokis/growtopia-data/main/5.45./decoded';
const ITEMS_TXT_URL = `${BASE_URL}/items.dat.txt`;
const TEXTURES_BASE_URL = `${BASE_URL}/textures`;
const OUTPUT_DIR = path.join(__dirname, 'icons');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Texture cache to avoid re-downloading
const textureCache = new Map();

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function fetchTexture(fileName) {
  if (textureCache.has(fileName)) {
    return textureCache.get(fileName);
  }

  const url = `${TEXTURES_BASE_URL}/${fileName}`;
  try {
    const buffer = await fetch(url);
    const img = await loadImage(buffer);
    textureCache.set(fileName, img);
    return img;
  } catch (err) {
    console.error(`Failed to load texture ${fileName}: ${err.message}`);
    return null;
  }
}

function pngName(fileName) {
  if (!fileName) return null;
  if (fileName.toLowerCase().endsWith('.png')) return fileName;
  const base = fileName.replace(/\.rttex$/i, '');
  if (/^player_(feet|handitem|longhanditem|cosmetics)/i.test(base)) {
    return base + '_icon.png';
  }
  return base + '.png';
}

function iconCoordinates(item) {
  const x = item.tex_x || 0;
  const y = item.tex_y || 0;
  const spread = item.storage_type || 0;

  if (spread === 2 || spread === 5) return [x + 4, y + 1];
  if (spread === 3) return [x + 3, y];
  return [x, y];
}

function isSeed(item) {
  return item.type !== 38 && (item.bloom_time || 0) !== 0;
}

function parseItemsTxt(txt) {
  const lines = txt.split('\n');
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('id|')) continue;

    const parts = trimmed.split('|').map(s => s.trim());
    if (parts.length < 34 || isNaN(parseInt(parts[0]))) continue;

    const n = (v) => {
      const x = parseInt(v, 10);
      return isNaN(x) ? 0 : x;
    };

    items.push({
      id: n(parts[0]),
      type: n(parts[2]),
      name: parts[4] || '',
      file_name: parts[5] || '',
      tex_x: n(parts[9]),
      tex_y: n(parts[10]),
      storage_type: n(parts[11]),
      clothing_type: n(parts[16]),
      bg_col: n(parts[30]),
      fg_col: n(parts[31]),
      seed1: n(parts[32]),
      seed2: n(parts[33]),
      bloom_time: n(parts[34]),
    });
  }

  return items.filter(item => item.name && item.file_name);
}

async function drawItemIcon(item) {
  const canvas = createCanvas(32, 32);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 32, 32);

  try {
    if (isSeed(item)) {
      // Seed rendering - skip for now, just fill with placeholder color
      ctx.fillStyle = '#8b7355';
      ctx.fillRect(0, 0, 32, 32);
      return canvas.toBuffer('image/png');
    }

    const pngFile = pngName(item.file_name);
    const img = await fetchTexture(pngFile);

    if (!img) {
      ctx.fillStyle = '#666';
      ctx.fillRect(0, 0, 32, 32);
      return canvas.toBuffer('image/png');
    }

    let [sx, sy] = iconCoordinates(item);

    // Special handling for player items
    const fileName = item.file_name.toLowerCase();
    if (/^player_(feet|handitem|longhanditem|cosmetics)/.test(fileName)) {
      if (fileName.includes('player_feet')) {
        sy = sy * 2;
      }
    }

    ctx.drawImage(img, sx * 32, sy * 32, 32, 32, 0, 0, 32, 32);
    return canvas.toBuffer('image/png');
  } catch (err) {
    console.error(`Error drawing item ${item.id}: ${err.message}`);
    ctx.fillStyle = '#666';
    ctx.fillRect(0, 0, 32, 32);
    return canvas.toBuffer('image/png');
  }
}

async function main() {
  console.log('Fetching items.dat.txt...');
  const itemsTxt = (await fetch(ITEMS_TXT_URL)).toString('utf-8');

  console.log('Parsing items...');
  const items = parseItemsTxt(itemsTxt);
  console.log(`Found ${items.length} items to generate`);

  const startTime = Date.now();
  let processed = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const buffer = await drawItemIcon(item);
      const outputPath = path.join(OUTPUT_DIR, `${item.id}.png`);
      fs.writeFileSync(outputPath, buffer);
      processed++;

      if (processed % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (items.length - processed) / rate;
        console.log(`Progress: ${processed}/${items.length} (${(processed/items.length*100).toFixed(1)}%) - ${rate.toFixed(1)}/s - ETA: ${remaining.toFixed(0)}s`);
      }
    } catch (err) {
      errors++;
      console.error(`Failed to generate icon for item ${item.id}: ${err.message}`);
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\nDone! Generated ${processed} icons in ${totalTime.toFixed(1)}s`);
  console.log(`Errors: ${errors}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
