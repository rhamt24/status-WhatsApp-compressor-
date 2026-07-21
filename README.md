# Status HD

Web app untuk mengoptimasi video jadi Status WhatsApp — 100% diproses di browser (ffmpeg.wasm), auto-split kalau video lebih dari 1 menit 30 detik.

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## Deploy ke Vercel

**Cara termudah — lewat GitHub:**
1. Push folder ini ke repo GitHub baru.
2. Buka https://vercel.com/new, pilih repo tersebut.
3. Vercel otomatis mendeteksi ini project Next.js — langsung klik **Deploy**, tidak perlu ubah setting apa pun.

**Atau lewat Vercel CLI (tanpa GitHub):**
```bash
npm install -g vercel
cd status-hd-next
vercel --prod
```
Ikuti prompt login, lalu project langsung ter-deploy dan dapat URL live.

## Catatan
- Tidak perlu environment variable atau konfigurasi header khusus — versi ffmpeg.wasm yang dipakai (single-thread) jalan tanpa perlu setting COOP/COEP di Vercel.
- Semua pemrosesan video terjadi di perangkat pengunjung, jadi tidak ada biaya bandwidth/compute tambahan di server Vercel untuk video itu sendiri.
