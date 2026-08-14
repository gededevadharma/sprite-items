# Growtools Item Icon API

Cloudflare Worker yang mengembalikan ikon item Growtopia (PNG) langsung dari repo
[`kabuokis/growtopia-data`](https://github.com/kabuokis/growtopia-data).

## Endpoint

| URL | Deskripsi |
| --- | --- |
| `/icon?id=2` | Ikon item (contoh: `2` = Dirt) pada versi terbaru |
| `/icon?id=2&v=5.40` | Ikon item pada versi data tertentu |
| `/icon?file=seed.png&x=384&y=672` | Crop manual 32×32 dari sebuah texture |

Contoh:

```
https://growtools-icon-api.<your-subdomain>.workers.dev/icon?id=2
```

## Cara deploy ke Cloudflare Workers

### 1. Bikin akun (kalau belum)
Daftar di <https://dash.cloudflare.com/sign-up>.

### 2. Install wrangler & login

```bash
cd icon-api
npm install
npx wrangler login
```

### 3. Deploy

```bash
npm run deploy
```

Setelah selesai, CLI menampilkan URL worker-nya (bentuknya
`https://growtools-icon-api.<subdomain>.workers.dev`).

## Cara test lokal

```bash
npm install
npm test            # validasi worker.js + test parser
npm run dev         # jalanin worker di http://localhost:8787
```

Lalu buka:

- <http://localhost:8787/icon?id=2> → PNG Dirt
- <http://localhost:8787/icon?file=seed.png&x=384&y=672> → crop manual

## Cara pakai dari frontend

```html
<img src="https://growtools-icon-api.<subdomain>.workers.dev/icon?id=2" alt="Dirt" />
```

## Struktur

```
icon-api/
  src/worker.js    ← logic Worker (parse items.dat + crop texture)
  test/            ← unit test (node:test, tanpa dependency)
  wrangler.toml    ← config Worker
  package.json
```

## Catatan

- Data & texture diambil dari `raw.githubusercontent.com/kabuokis/growtopia-data/main/<version>/`.
- Parse `items.dat` meniru `src/lib/datParser.ts` di repo Growtools (format binary versi 0–26).
- Icon seed dirender ulang (tint warna) seperti `drawSeedBadge()` di app, karena seed tidak punya
  texture sendiri.
