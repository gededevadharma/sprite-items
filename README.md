# 🧩 Sprite Items Icon

Situs statis (GitHub Pages) untuk menjelajah & mengunduh **ikon item Growtopia**.
Data & texture diambil langsung dari repo
[`kabuokis/growtopia-data`](https://github.com/kabuokis/growtopia-data)
di sisi browser — tanpa server, tanpa runtime khusus.

## Fitur
- Pencarian item berdasarkan **nama** atau **ID**
- Pilih **versi data** (5.45., 5.42, 2.78, …)
- Ikon di-crop dari sprite sheet (32×32) langsung di canvas browser
- Seed item dirender dengan warna tint (mirip app Growtools)
- Klik item → detail + **download PNG** + **salin deep link** `?id=..&v=..`
- Deep link bisa langsung membuka item tertentu

## Deploy ke GitHub Pages

Repo ini adalah folder yang siap di-upload ke GitHub Pages:

### 1. Buat repo di GitHub
Buka <https://github.com/new>
- **Repository name:** `item-sprite`
- Set **Public**
- Kosong (tanpa README/gitignore/license)

### 2. Push dari folder ini
```bash
git init -b main
git add -A
git commit -m "Sprite Items Icon - GitHub Pages"
git remote add origin https://github.com/<USERNAME>/item-sprite.git
git push -u origin main
```

### 3. Aktifkan GitHub Pages
Di repo → **Settings → Pages**:
- **Source:** `Deploy from a branch`
- **Branch:** `main` / `/ (root)`
- Save

Situs langsung tampil di:
```
https://<USERNAME>.github.io/item-sprite/
```

> URL folder repo mengikuti nama GitHub repo (bisa berbeda dari folder lokal).
> `404.html` dipakai supaya jalur seperti `?id=2` tetap diarahkan ke beranda.

## Pakai dari aplikasi lain
Situs adalah halaman interaktif, bukan API JSON. Untuk mendapatkan gambar ikon oleh
item ID dari luar aplikasi, buka halaman dengan deep link:
```
https://<USERNAME>.github.io/item-sprite/?id=2
```
Browser menampilkan item tsb; untuk mengunduh PNG-nya gunakan tombol download di dialog.

## Struktur
```
item-sprite/
  index.html   ← UI utama
  app.js       ← logic (fetch data, crop canvas, render)
  404.html     ← fallback SPA
  README.md
```

## Catatan teknis
- Sumber data: `raw.githubusercontent.com/kabuokis/growtopia-data/main/<ver>/decoded/items.dat.txt`
  (text, kolom pipa) — robust & CORS `*` tersedia.
- Texture: `.../<ver>/decoded/textures/<nama>.png` (sprite sheet), kolom `tex_x`/`tex_y`,
  dengan offset `spread_type` untuk posisi ikon.
- Ikon seed dirender dari `seed.png` + warna `bg_col`/`fg_col`.