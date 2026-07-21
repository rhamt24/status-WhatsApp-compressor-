# Status HD

Web app untuk mengoptimasi video jadi Status WhatsApp — 100% diproses di browser lewat **WebCodecs API** (decode/encode video pakai GPU perangkat kalau tersedia), auto-split kalau video lebih dari 1 menit 30 detik.

**Batasan versi GPU ini:** hanya menerima input **MP4** (mp4box.js dipakai untuk membongkar/demux MP4, lalu WebCodecs decode→encode, lalu di-mux ulang jadi MP4 pakai mp4-muxer). File MOV/MKV/WebM tidak didukung — user akan diminta convert dulu atau pakai versi lama (ffmpeg.wasm) kalau perlu dukungan format lebih luas. Audio bersifat best-effort: kalau AAC-nya gagal didekode, video tetap dihasilkan tapi tanpa suara, daripada gagal total.

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
- Tidak perlu environment variable tambahan. Header COOP/COEP di `next.config.js` tetap dibiarkan aktif (tidak mengganggu WebCodecs, dan berguna kalau nanti perlu SharedArrayBuffer lagi).
- Semua pemrosesan video terjadi di perangkat pengunjung, jadi tidak ada biaya bandwidth/compute tambahan di server Vercel untuk video itu sendiri.
- WebCodecs (VideoEncoder/VideoDecoder) baru didukung luas di Chrome/Edge/Opera (Chromium). Di Safari/Firefox versi lama, app akan menampilkan pesan error yang jelas dan menyarankan pindah browser.
- GPU dipilih otomatis lewat `hardwareAcceleration: "prefer-hardware"`. Kalau device/browser tidak punya encoder H.264 hardware, WebCodecs akan otomatis fallback ke software encoder bawaan browser — proses tetap jalan, cuma nggak secepat kalau ada GPU.
