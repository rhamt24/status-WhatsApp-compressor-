"use client";

import { useEffect } from "react";

const SPLIT_SECONDS = 90;
const MP4BOX_URL = "https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js";
const MP4_MUXER_URL = "https://esm.run/mp4-muxer@5.2.2";

export default function Page() {
  useEffect(() => {
    let currentFile = null;
    let currentFileBuffer = null; 
    let currentFileReadError = null;
    let currentMeta = { duration: 0, width: 0, height: 0 };

    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("fileInput");
    const sourcePanel = document.getElementById("sourcePanel");
    const sourceVideo = document.getElementById("sourceVideo");
    const sourceTag = document.getElementById("sourceTag");
    const statDuration = document.getElementById("statDuration");
    const statRes = document.getElementById("statRes");
    const statSize = document.getElementById("statSize");
    const statBitrate = document.getElementById("statBitrate");
    const splitNote = document.getElementById("splitNote");
    const processBtn = document.getElementById("processBtn");
    const progressRow = document.getElementById("progressRow");
    const progressLabel = document.getElementById("progressLabel");
    const errorBox = document.getElementById("errorBox");
    const resultPanel = document.getElementById("resultPanel");
    const partsGrid = document.getElementById("partsGrid");

    function fmtTime(s) {
      const m = Math.floor(s / 60),
        sec = Math.round(s % 60);
      return `${m}:${String(sec).padStart(2, "0")}`;
    }
    function fmtSize(bytes) {
      if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
      return (bytes / 1024).toFixed(0) + " KB";
    }

    function openFile(file) {
      if (!file || !file.type.startsWith("video/")) {
        alert("Pilih file video ya.");
        return;
      }
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ext !== "mp4" && ext !== "m4v" && file.type !== "video/mp4") {
        alert(
          "Versi GPU cuma dukung file MP4 (hasil rekam HP kebanyakan sudah MP4). File MOV/MKV/WebM belum didukung."
        );
        return;
      }

      currentFile = file;
      currentFileBuffer = null;
      currentFileReadError = null;
      errorBox.classList.add("hidden");
      resultPanel.classList.add("hidden");
      partsGrid.innerHTML = "";
      progressRow.classList.add("hidden");

      file
        .arrayBuffer()
        .then((buf) => {
          currentFileBuffer = buf;
        })
        .catch((e) => {
          console.warn("Gagal pre-baca file:", e);
          currentFileReadError = e;
        });

      const url = URL.createObjectURL(file);
      sourceVideo.src = url;
      sourcePanel.classList.remove("hidden");
      sourceTag.textContent = "memeriksa…";

      sourceVideo.onloadedmetadata = () => {
        currentMeta.duration = sourceVideo.duration;
        currentMeta.width = sourceVideo.videoWidth;
        currentMeta.height = sourceVideo.videoHeight;

        statDuration.textContent = fmtTime(currentMeta.duration);
        statRes.textContent = `${currentMeta.width}×${currentMeta.height}`;
        statSize.textContent = fmtSize(file.size);

        const bitrateMbps = (
          (file.size * 8) / currentMeta.duration / 1_000_000
        ).toFixed(1);
        statBitrate.textContent = `${bitrateMbps} Mbps`;

        const weakSignal = currentMeta.height < 720 || bitrateMbps < 3;
        sourceTag.textContent = weakSignal
          ? "Rawan pecah di WA"
          : "Kualitas oke, tetap dioptimalkan";
        sourceTag.className = weakSignal ? "tag warn" : "tag ok";

        if (currentMeta.duration > SPLIT_SECONDS) {
          const parts = Math.ceil(currentMeta.duration / SPLIT_SECONDS);
          splitNote.classList.remove("hidden");
          splitNote.textContent = `Video ini ${fmtTime(
            currentMeta.duration
          )}, lebih dari batas status 1:30. Akan dipotong otomatis jadi ${parts} bagian saat diproses.`;
        } else {
          splitNote.classList.add("hidden");
        }
      };

      sourceVideo.onerror = () => {
        sourceTag.textContent = "Gagal dibaca";
        sourceTag.className = "tag warn";
      };
    }

    function handleDropzoneClick() {
      fileInput.click();
    }
    function handleFileChange(e) {
      openFile(e.target.files[0]);
    }
    function handleDragOver(e) {
      e.preventDefault();
      dropzone.classList.add("drag");
    }
    function handleDragLeave(e) {
      e.preventDefault();
      dropzone.classList.remove("drag");
    }
    function handleDrop(e) {
      e.preventDefault();
      dropzone.classList.remove("drag");
      const file = e.dataTransfer.files[0];
      if (file) openFile(file);
    }

    dropzone.addEventListener("click", handleDropzoneClick);
    fileInput.addEventListener("change", handleFileChange);
    dropzone.addEventListener("dragenter", handleDragOver);
    dropzone.addEventListener("dragover", handleDragOver);
    dropzone.addEventListener("dragleave", handleDragLeave);
    dropzone.addEventListener("drop", handleDrop);

    function setProgress(text) {
      progressRow.classList.remove("hidden");
      progressLabel.textContent = text;
    }

    // ---------- loader helpers ----------

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-src="${src}"]`);
        if (existing) {
          if (existing.dataset.loaded === "1") return resolve();
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", reject);
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.crossOrigin = "anonymous";
        script.dataset.src = src;
        script.onload = () => {
          script.dataset.loaded = "1";
          resolve();
        };
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    async function ensureMp4Box() {
      if (window.MP4Box) return;
      await loadScript(MP4BOX_URL);
    }

    const dynamicImport = new Function("specifier", "return import(specifier)");
    let mp4MuxerModPromise = null;
    function ensureMp4Muxer() {
      if (!mp4MuxerModPromise) mp4MuxerModPromise = dynamicImport(MP4_MUXER_URL);
      return mp4MuxerModPromise;
    }

    // ---------- mp4box helpers ----------

    function getVideoDescription(mp4boxFile, track) {
      const trak = mp4boxFile.getTrackById(track.id);
      for (const entry of trak.mdia.minf.stbl.stsd.entries) {
        const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
        if (box) {
          const DS = window.DataStream || window.MP4Box?.DataStream;
          if (!DS) {
            throw new Error(
              "DataStream tidak ditemukan di window — versi mp4box.js yang dimuat mungkin tidak kompatibel."
            );
          }
          const stream = new DS(undefined, 0, DS.BIG_ENDIAN);
          box.write(stream);
          return new Uint8Array(stream.buffer, 8); 
        }
      }
      return undefined;
    }

    function getAudioDescription(mp4boxFile, track) {
      try {
        const trak = mp4boxFile.getTrackById(track.id);
        for (const entry of trak.mdia.minf.stbl.stsd.entries) {
          if (entry.esds && entry.esds.esd && entry.esds.esd.descs) {
            const decoderConfig = entry.esds.esd.descs[0]?.descs?.[0];
            if (decoderConfig && decoderConfig.data) return decoderConfig.data;
          }
        }
      } catch (e) {
        console.warn("Gagal ambil audio description:", e);
      }
      return undefined;
    }

    function demuxMp4(arrayBuffer) {
      return new Promise((resolve, reject) => {
        const mp4boxFile = window.MP4Box.createFile();
        const videoSamples = [];
        const audioSamples = [];
        let videoTrack = null;
        let audioTrack = null;

        mp4boxFile.onError = (e) => reject(new Error("Gagal membaca MP4: " + e));

        mp4boxFile.onReady = (info) => {
          videoTrack = info.videoTracks[0] || null;
          audioTrack = info.audioTracks[0] || null;
          if (!videoTrack) {
            reject(new Error("Tidak ada video track di file ini."));
            return;
          }
          mp4boxFile.setExtractionOptions(videoTrack.id, "video", { nbSamples: Infinity });
          if (audioTrack) {
            mp4boxFile.setExtractionOptions(audioTrack.id, "audio", { nbSamples: Infinity });
          }
          mp4boxFile.start();
        };

        mp4boxFile.onSamples = (trackId, ref, samples) => {
          if (ref === "video") videoSamples.push(...samples);
          else if (ref === "audio") audioSamples.push(...samples);
        };

        try {
          const buf = arrayBuffer.slice(0);
          buf.fileStart = 0;
          mp4boxFile.appendBuffer(buf);
          mp4boxFile.flush();
          resolve({ mp4boxFile, videoTrack, audioTrack, videoSamples, audioSamples });
        } catch (e) {
          reject(e);
        }
      });
    }

    function safeCloseCodec(codec) {
      try {
        if (codec && codec.state !== "closed") codec.close();
      } catch (e) {
        console.warn("Gagal menutup codec (mungkin sudah closed):", e);
      }
    }

    async function pickVideoCodec(width, height, hardwareAcceleration) {
      const candidates = ["avc1.640028", "avc1.4d0028", "avc1.42001f"];
      for (const codec of candidates) {
        const config = {
          codec,
          width,
          height,
          hardwareAcceleration,
        };
        try {
          const support = await VideoEncoder.isConfigSupported(config);
          if (support.supported) return codec;
        } catch (e) {
          // lanjut coba kandidat berikutnya
        }
      }
      return null;
    }

    // ---------- part writer (1 file mp4 output per bagian) ----------

    function createPartWriter({ Mp4Muxer, width, height, videoCodec, bitrate, hasAudio, audioCodec, sampleRate, channels }) {
      const target = new Mp4Muxer.ArrayBufferTarget();
      const muxerConfig = {
        target,
        fastStart: "in-memory",
        video: { codec: "avc", width, height },
      };
      if (hasAudio) {
        muxerConfig.audio = { codec: "aac", numberOfChannels: channels, sampleRate };
      }
      const muxer = new Mp4Muxer.Muxer(muxerConfig);

      let firstVideoChunk = true;

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => {
          // Clone meta object untuk menghindari mutasi objek read-only dari browser
          let safeMeta = meta ? { ...meta } : {};

          // FIX 1: Cegah crash jika browser gagal mengirimkan decoderConfig di chunk pertama
          if (firstVideoChunk) {
            firstVideoChunk = false;
            if (!safeMeta.decoderConfig) {
              safeMeta.decoderConfig = {
                codec: videoCodec,
                codedWidth: width,
                codedHeight: height,
                description: new Uint8Array(0), // Dummy description aman untuk mp4-muxer
              };
            }
          }

          // FIX 2: Hapus colorSpace jika secara eksplisit bernilai null supaya mp4-muxer tidak crash
          if (safeMeta.decoderConfig && safeMeta.decoderConfig.colorSpace === null) {
            safeMeta.decoderConfig = { ...safeMeta.decoderConfig };
            delete safeMeta.decoderConfig.colorSpace;
          }

          muxer.addVideoChunk(chunk, safeMeta);
        },
        error: (e) => console.error("VideoEncoder error:", e),
      });

      videoEncoder.configure({
        codec: videoCodec,
        width,
        height,
        bitrate,
        hardwareAcceleration: "prefer-hardware",
        bitrateMode: "variable",
      });

      let audioEncoder = null;
      if (hasAudio) {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: (e) => console.error("AudioEncoder error:", e),
        });
        audioEncoder.configure({
          codec: audioCodec,
          sampleRate,
          numberOfChannels: channels,
          bitrate: 128_000,
        });
      }

      let videoFrameCount = 0;

      return {
        encodeVideoFrame(frame, forceKeyFrame) {
          videoEncoder.encode(frame, { keyFrame: forceKeyFrame || videoFrameCount === 0 });
          videoFrameCount++;
          frame.close();
        },
        encodeAudioData(data) {
          if (audioEncoder) audioEncoder.encode(data);
          data.close();
        },
        async finish() {
          await videoEncoder.flush();
          safeCloseCodec(videoEncoder);
          if (audioEncoder) {
            await audioEncoder.flush();
            safeCloseCodec(audioEncoder);
          }
          muxer.finalize();
          return new Blob([target.buffer], { type: "video/mp4" });
        },
      };
    }

    // ---------- pipeline utama ----------

    async function handleProcessClick() {
      if (!currentFile) return;
      if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") {
        errorBox.textContent =
          "Browser ini belum dukung WebCodecs (VideoEncoder/VideoDecoder). Coba pakai Chrome/Edge versi terbaru.";
        errorBox.classList.remove("hidden");
        return;
      }

      processBtn.disabled = true;
      errorBox.classList.add("hidden");
      resultPanel.classList.add("hidden");
      partsGrid.innerHTML = "";

      const canvas = document.createElement("canvas");
      let ctx = null;

      try {
        setProgress("Menyiapkan mesin video (mp4box + mp4-muxer)…");
        await ensureMp4Box();
        const Mp4Muxer = await ensureMp4Muxer();

        setProgress("Membaca & membongkar MP4…");
        let bufferToUse = currentFileBuffer;
        if (!bufferToUse) {
          try {
            bufferToUse = await currentFile.arrayBuffer();
            currentFileBuffer = bufferToUse;
          } catch (e) {
            throw new Error(
              "File videonya sudah tidak bisa diakses lagi (izin dari sistem hilang, sering terjadi kalau file dipilih dari Galeri/Google Photos di Android). Silakan pilih ulang videonya lewat tombol upload, lalu langsung klik Proses tanpa berpindah aplikasi dulu."
            );
          }
        }
        const { mp4boxFile, videoTrack, audioTrack, videoSamples, audioSamples } =
          await demuxMp4(bufferToUse);

        const srcWidth = videoTrack.track_width || videoTrack.video?.width || currentMeta.width;
        const srcHeight = videoTrack.track_height || videoTrack.video?.height || currentMeta.height;
        const targetHeight = srcHeight >= 1080 ? 1080 : srcHeight >= 720 ? srcHeight : 720;
        let targetWidth = Math.round((srcWidth * targetHeight) / srcHeight);
        if (targetWidth % 2 !== 0) targetWidth += 1;
        const outHeight = targetHeight % 2 !== 0 ? targetHeight + 1 : targetHeight;

        canvas.width = targetWidth;
        canvas.height = outHeight;
        ctx = canvas.getContext("2d");

        const bitrate =
          outHeight >= 1080 ? 6_000_000 : outHeight >= 720 ? 4_000_000 : 2_500_000;

        setProgress("Memilih encoder video (coba akses GPU)…");
        const videoCodec = await pickVideoCodec(targetWidth, outHeight, "prefer-hardware");
        if (!videoCodec) {
          throw new Error(
            "Tidak ada encoder H.264 yang didukung browser ini (hardware maupun software)."
          );
        }
        
        let usingHardware = true;
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec: videoCodec,
            width: targetWidth,
            height: outHeight,
            hardwareAcceleration: "prefer-hardware",
          });
          usingHardware = !!support.supported;
        } catch (e) {
          usingHardware = false;
        }

        const videoDescription = getVideoDescription(mp4boxFile, videoTrack);
        const videoDecoderConfig = {
          codec: videoTrack.codec,
          codedWidth: srcWidth,
          codedHeight: srcHeight,
          description: videoDescription,
          hardwareAcceleration: "prefer-hardware",
        };

        let hasAudio = false;
        let audioSampleRate = 48000;
        let audioChannels = 2;
        const audioCodecStr = "mp4a.40.2";
        let audioDescription;
        if (audioTrack) {
          try {
            audioSampleRate = audioTrack.audio?.sample_rate || audioTrack.samplerate || 48000;
            audioChannels = audioTrack.audio?.channel_count || audioTrack.channel_count || 2;
            audioDescription = getAudioDescription(mp4boxFile, audioTrack);
            const audioSupport = await AudioEncoder.isConfigSupported({
              codec: audioCodecStr,
              sampleRate: audioSampleRate,
              numberOfChannels: audioChannels,
              bitrate: 128_000,
            });
            hasAudio = !!audioSupport.supported;
          } catch (e) {
            console.warn("Audio tidak didukung, lanjut tanpa audio:", e);
            hasAudio = false;
          }
        }

        const duration = currentMeta.duration;
        const totalParts =
          duration > SPLIT_SECONDS ? Math.ceil(duration / SPLIT_SECONDS) : 1;

        const partPromises = [];
        let currentPart = null;
        let currentPartIndex = -1;
        let currentPartStartUs = 0;

        function startPart(index) {
          currentPartIndex = index;
          currentPartStartUs = index * SPLIT_SECONDS * 1_000_000;
          currentPart = createPartWriter({
            Mp4Muxer,
            width: targetWidth,
            height: outHeight,
            videoCodec,
            bitrate,
            hasAudio,
            audioCodec: audioCodecStr,
            sampleRate: audioSampleRate,
            channels: audioChannels,
          });
        }

        function finishCurrentPart() {
          if (!currentPart) return;
          const part = currentPart;
          const index = currentPartIndex;
          partPromises.push(part.finish().then((blob) => ({ blob, index })));
          currentPart = null;
        }

        function partIndexForUs(tUs) {
          const idx = Math.floor(tUs / (SPLIT_SECONDS * 1_000_000));
          return Math.min(totalParts - 1, Math.max(0, idx));
        }

        function routeVideoFrame(frame) {
          const tUs = frame.timestamp;
          const idx = partIndexForUs(tUs);
          if (idx !== currentPartIndex) {
            finishCurrentPart();
            startPart(idx);
          }
          const relativeUs = tUs - currentPartStartUs;

          ctx.drawImage(frame, 0, 0, targetWidth, outHeight);
          const scaled = new VideoFrame(canvas, {
            timestamp: Math.max(0, relativeUs),
            duration: frame.duration || undefined,
          });
          currentPart.encodeVideoFrame(scaled, relativeUs === 0);
          frame.close();

          const overall = (idx + Math.min(1, relativeUs / (SPLIT_SECONDS * 1_000_000))) / totalParts;
          progressLabel.textContent =
            totalParts > 1
              ? `Memproses bagian ${idx + 1}/${totalParts} — ${Math.round(overall * 100)}% (GPU)`
              : `Memproses video — ${Math.round((tUs / 1e6 / duration) * 100)}% (GPU)`;
        }

        function routeAudioData(data) {
          const tUs = data.timestamp;
          const idx = partIndexForUs(tUs);
          if (idx !== currentPartIndex) {
            data.close();
            return;
          }
          currentPart.encodeAudioData(data);
        }

        setProgress("Mendekode & mengencode video…");

        const videoDecoder = new VideoDecoder({
          output: routeVideoFrame,
          error: (e) => console.error("VideoDecoder error:", e),
        });
        videoDecoder.configure(videoDecoderConfig);

        let audioDecoder = null;
        if (hasAudio) {
          audioDecoder = new AudioDecoder({
            output: routeAudioData,
            error: (e) => console.error("AudioDecoder error:", e),
          });
          try {
            audioDecoder.configure({
              codec: audioCodecStr,
              sampleRate: audioSampleRate,
              numberOfChannels: audioChannels,
              description: audioDescription,
            });
          } catch (e) {
            console.warn("Gagal configure AudioDecoder, lanjut tanpa audio:", e);
            hasAudio = false;
            audioDecoder = null;
          }
        }

        startPart(0);

        for (const sample of videoSamples) {
          const chunk = new EncodedVideoChunk({
            type: sample.is_sync ? "key" : "delta",
            timestamp: Math.round((sample.cts * 1_000_000) / sample.timescale),
            duration: Math.round((sample.duration * 1_000_000) / sample.timescale),
            data: sample.data,
          });
          videoDecoder.decode(chunk);
        }
        await videoDecoder.flush();
        safeCloseCodec(videoDecoder);

        if (hasAudio && audioDecoder) {
          for (const sample of audioSamples) {
            if (audioDecoder.state === "closed") break; 
            const chunk = new EncodedAudioChunk({
              type: sample.is_sync ? "key" : "delta",
              timestamp: Math.round((sample.cts * 1_000_000) / sample.timescale),
              duration: Math.round((sample.duration * 1_000_000) / sample.timescale),
              data: sample.data,
            });
            try {
              audioDecoder.decode(chunk);
            } catch (e) {
              console.warn("Lewati sample audio bermasalah:", e);
            }
          }
          if (audioDecoder.state !== "closed") {
            try {
              await audioDecoder.flush();
            } catch (e) {
              console.warn("Audio flush error:", e);
            }
          }
          safeCloseCodec(audioDecoder);
        }

        finishCurrentPart();
        setProgress(
          usingHardware
            ? "Menyelesaikan file (encoder GPU)…"
            : "Menyelesaikan file (fallback software, GPU tidak tersedia di browser ini)…"
        );

        const outputs = await Promise.all(partPromises);
        outputs.sort((a, b) => a.index - b.index);

        progressRow.classList.add("hidden");
        resultPanel.classList.remove("hidden");
        outputs.forEach(({ blob, index }) => {
          const url = URL.createObjectURL(blob);
          const partDur =
            index === totalParts - 1 ? duration - index * SPLIT_SECONDS : SPLIT_SECONDS;
          const card = document.createElement("div");
          card.className = "part";
          card.innerHTML = `
            <video src="${url}" controls></video>
            <div class="part-body">
              <div class="part-title">
                <span>${
                  totalParts > 1 ? `Bagian ${index + 1} dari ${totalParts}` : "Video jadi"
                }</span>
                <span>${fmtTime(partDur)} · ${fmtSize(blob.size)}</span>
              </div>
              <a class="download" href="${url}" download="status-hd-${
            totalParts > 1 ? "part" + (index + 1) + "-" : ""
          }${currentFile.name.replace(/\.[^.]+$/, "")}.mp4">
                Unduh Video
              </a>
            </div>`;
          partsGrid.appendChild(card);
        });
      } catch (err) {
        console.error(err);
        errorBox.textContent =
          "Gagal memproses video: " +
          (err && err.message ? err.message : String(err)) +
          ". Pastikan file MP4 dan browser mendukung WebCodecs (Chrome/Edge terbaru disarankan).";
        errorBox.classList.remove("hidden");
        progressRow.classList.add("hidden");
      } finally {
        processBtn.disabled = false;
      }
    }

    processBtn.addEventListener("click", handleProcessClick);

    return () => {
      dropzone.removeEventListener("click", handleDropzoneClick);
      fileInput.removeEventListener("change", handleFileChange);
      dropzone.removeEventListener("dragenter", handleDragOver);
      dropzone.removeEventListener("dragover", handleDragOver);
      dropzone.removeEventListener("dragleave", handleDragLeave);
      dropzone.removeEventListener("drop", handleDrop);
      processBtn.removeEventListener("click", handleProcessClick);
    };
  }, []);

  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Diproses di perangkatmu (GPU) — tidak diunggah ke server</div>
        <h1>Status HD</h1>
        <p>
          Perbaiki video sebelum jadi Status WhatsApp. <b>Status HD</b> mengatur ulang
          bitrate dan resolusi supaya kompresi WhatsApp nggak bikin video pecah — dan
          otomatis membagi video ke beberapa bagian kalau lebih dari 1 menit 30 detik.
          Proses encode/decode video lewat WebCodecs, otomatis pakai GPU kalau
          browser & perangkat mendukung.
        </p>
      </header>

      <div className="dropzone" id="dropzone">
        <div className="meter weak" style={{ justifyContent: "center", margin: "0 auto 14px" }}>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        <div className="dz-title">Taruh video MP4 di sini, atau ketuk untuk memilih file</div>
        <div className="dz-sub">MP4 saja (versi GPU) — diproses lokal di browser</div>
        <input type="file" id="fileInput" accept="video/mp4" />
      </div>

      <div className="panel hidden" id="sourcePanel">
        <div className="panel-head">
          <h2>Video Asli</h2>
          <span className="tag" id="sourceTag">memeriksa…</span>
        </div>
        <video id="sourceVideo" controls></video>
        <div className="stats">
          <div className="stat"><div className="k">Durasi</div><div className="v" id="statDuration">–</div></div>
          <div className="stat"><div className="k">Resolusi</div><div className="v" id="statRes">–</div></div>
          <div className="stat"><div className="k">Ukuran</div><div className="v" id="statSize">–</div></div>
          <div className="stat"><div className="k">Bitrate ±</div><div className="v" id="statBitrate">–</div></div>
        </div>
        <div className="splitnote hidden" id="splitNote"></div>
        <div style={{ marginTop: 18 }}>
          <button className="primary" id="processBtn">Proses Video (GPU)</button>
        </div>
        <div className="progress-row hidden" id="progressRow">
          <span className="progress-label" id="progressLabel">Menyiapkan mesin video…</span>
          <div className="meter pulse" id="progressMeter">
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div className="error-box hidden" id="errorBox"></div>
      </div>

      <div className="panel hidden" id="resultPanel">
        <div className="panel-head">
          <h2>Hasil</h2>
          <span className="tag ok">Siap dijadikan status</span>
        </div>
        <div className="meter strong" style={{ marginBottom: 14 }}>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        <div className="parts" id="partsGrid"></div>
      </div>

      <div className="foot">status-hd · pemrosesan lokal via WebCodecs (GPU) + mp4box.js + mp4-muxer</div>
    </div>
  );
}
