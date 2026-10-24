# sprite-items

Situs statis untuk menjelajah & mengunduh **ikon item Growtopia**.
Data & texture diambil langsung dari repo
[`kabuokis/growtopia-data`](https://github.com/kabuokis/growtopia-data)
di sisi browser — tanpa server, tanpa runtime khusus.

**Demo:** https://gededevadharma.github.io/sprite-items/

## Fitur

- Pencarian item berdasarkan **nama** atau **ID**
- Pilih **versi data** (5.45., 5.42, 2.78, …)
- Ikon di-crop dari sprite sheet (32×32) langsung di canvas browser
- Seed item dirender dengan warna tint (mirip app Growtools)
- Klik item → detail + **download PNG** + **salin deep link** `?id=..&v=..`
- Deep link bisa langsung membuka item tertentu

## Cara Pakai

1. Buka demo di atas.
2. Cari item lewat kolom pencarian (nama atau ID), atau pilih versi
   data yang diinginkan.
3. Klik sebuah item untuk melihat detailnya.
4. Unduh ikonnya sebagai PNG, atau salin deep link-nya untuk dibagikan.
5. Deep link juga bisa dibuka langsung, contoh:

```
https://gededevadharma.github.io/sprite-items/?id=2
```

Browser akan menampilkan item tersebut; untuk mengunduh PNG-nya gunakan
tombol download di dialog.

## Jalanin Lokal

Situs ini statis, jadi cukup buka `index.html` di browser. Alternatifnya,
jalankan server statis apa pun dari folder ini, contoh:

```bash
npx serve .
```

## Generate Ikon Massal

Untuk generate ikon lewat Node (lihat `generate-icons.js`):

```bash
npm install
npm run generate
```

## Deploy ke GitHub Pages

Repo ini sudah live di GitHub Pages. Kalau perlu mengaktifkan ulang dari
nol, di repo → **Settings → Pages**:

- **Source:** `Deploy from a branch`
- **Branch:** `main` / `/ (root)`
- Save

Situs tampil di:

```
https://gededevadharma.github.io/sprite-items/
```

> `404.html` dipakai supaya jalur seperti `?id=2` tetap diarahkan ke
> beranda.

## Pakai dari Aplikasi Lain

Situs adalah halaman interaktif, bukan API JSON. Untuk mendapatkan gambar
ikon oleh item ID dari luar aplikasi, buka halaman dengan deep link
(contoh di atas). Browser menampilkan item tersebut; untuk mengunduh
PNG-nya gunakan tombol download di dialog.

## Struktur

```
sprite-items/
  index.html        ← UI utama
  app.js            ← logic (fetch data, crop canvas, render)
  generate-icons.js ← generate ikon massal lewat Node
  404.html          ← fallback SPA
  icons/            ← hasil generate ikon
  README.md
```

## Catatan Teknis

- Sumber data: `raw.githubusercontent.com/kabuokis/growtopia-data/main/<ver>/decoded/items.dat.txt`
  (text, kolom pipa) — robust & CORS `*` tersedia.
- Texture: `.../<ver>/decoded/textures/<nama>.png` (sprite sheet), kolom `tex_x`/`tex_y`,
  dengan offset `spread_type` untuk posisi ikon.
- Ikon seed dirender dari `seed.png` + warna `bg_col`/`fg_col`.
