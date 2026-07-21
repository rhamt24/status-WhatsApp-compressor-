"use client";

import { useEffect } from "react";

const SPLIT_SECONDS = 90;

export default function Page() {
  useEffect(() => {
    let ffmpeg = null;
    let ffmpegReady = false;
    let currentFile = null;
    let currentMeta = { duration: 0, width: 0, height: 0 };
    let partIndex = 0;

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
      currentFile = file;
      errorBox.classList.add("hidden");
      resultPanel.classList.add("hidden");
      partsGrid.innerHTML = "";
      progressRow.classList.add("hidden");

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

    async function ensureFfmpegLoaded() {
      if (window.FFmpeg) return;
      await new Promise((resolve, reject) => {
        const existing = document.getElementById("ffmpeg-script");
        if (existing) {
          existing.addEventListener("load", resolve);
          return;
        }
        const script = document.createElement("script");
        script.id = "ffmpeg-script";
        script.src =
          "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    async function handleProcessClick() {
      if (!currentFile) return;
      processBtn.disabled = true;
      errorBox.classList.add("hidden");
      resultPanel.classList.add("hidden");
      partsGrid.innerHTML = "";

      try {
        await ensureFfmpegLoaded();
        const { createFFmpeg, fetchFile } = window.FFmpeg;

        if (!ffmpeg) {
          ffmpeg = createFFmpeg({
            log: false,
            corePath:
              "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
          });
        }
        if (!ffmpegReady) {
          setProgress("Menyiapkan mesin video (sekali saja)…");
          await ffmpeg.load();
          ffmpegReady = true;
        }

        const ext = (currentFile.name.split(".").pop() || "mp4").toLowerCase();
        const inputName = `input.${ext}`;
        setProgress("Membaca file…");
        ffmpeg.FS("writeFile", inputName, await fetchFile(currentFile));

        const duration = currentMeta.duration;
        const totalParts =
          duration > SPLIT_SECONDS ? Math.ceil(duration / SPLIT_SECONDS) : 1;
        const targetHeight =
          currentMeta.height >= 1080
            ? 1080
            : currentMeta.height >= 720
            ? currentMeta.height
            : 720;

        ffmpeg.setProgress(({ ratio }) => {
          if (ratio >= 0 && ratio <= 1) {
            const overall = (partIndex + ratio) / totalParts;
            progressLabel.textContent =
              totalParts > 1
                ? `Memproses bagian ${partIndex + 1}/${totalParts} — ${Math.round(
                    overall * 100
                  )}%`
                : `Memproses video — ${Math.round(ratio * 100)}%`;
          }
        });

        const outputs = [];
        for (let i = 0; i < totalParts; i++) {
          partIndex = i;
          const start = i * SPLIT_SECONDS;
          const dur = Math.min(SPLIT_SECONDS, duration - start);
          const outName = totalParts > 1 ? `output_part${i + 1}.mp4` : "output.mp4";

          const args = [];
          if (totalParts > 1) {
            args.push("-ss", String(start), "-t", String(dur));
          }
          args.push(
            "-i",
            inputName,
            "-vf",
            `scale=-2:${targetHeight}`,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "19",
            "-maxrate",
            "6M",
            "-bufsize",
            "12M",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            outName
          );
          await ffmpeg.run(...args);
          const data = ffmpeg.FS("readFile", outName);
          const blob = new Blob([data.buffer], { type: "video/mp4" });
          outputs.push({ name: outName, blob, index: i + 1, dur });
          ffmpeg.FS("unlink", outName);
        }
        ffmpeg.FS("unlink", inputName);

        progressRow.classList.add("hidden");
        resultPanel.classList.remove("hidden");
        outputs.forEach((o) => {
          const url = URL.createObjectURL(o.blob);
          const card = document.createElement("div");
          card.className = "part";
          card.innerHTML = `
            <video src="${url}" controls></video>
            <div class="part-body">
              <div class="part-title">
                <span>${
                  totalParts > 1 ? `Bagian ${o.index} dari ${totalParts}` : "Video jadi"
                }</span>
                <span>${fmtTime(o.dur)} · ${fmtSize(o.blob.size)}</span>
              </div>
              <a class="download" href="${url}" download="status-hd-${
            totalParts > 1 ? "part" + o.index + "-" : ""
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
          ". Coba video lain atau muat ulang halaman.";
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
        <div className="eyebrow">Diproses di perangkatmu — tidak diunggah ke server</div>
        <h1>Status HD</h1>
        <p>
          Perbaiki video sebelum jadi Status WhatsApp. <b>Status HD</b> mengatur ulang
          bitrate dan resolusi supaya kompresi WhatsApp nggak bikin video pecah — dan
          otomatis membagi video ke beberapa bagian kalau lebih dari 1 menit 30 detik.
        </p>
      </header>

      <div className="dropzone" id="dropzone">
        <div className="meter weak" style={{ justifyContent: "center", margin: "0 auto 14px" }}>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        <div className="dz-title">Taruh video di sini, atau ketuk untuk memilih file</div>
        <div className="dz-sub">MP4, MOV, MKV, WebM — semua diproses lokal di browser</div>
        <input type="file" id="fileInput" accept="video/*" />
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
          <button className="primary" id="processBtn">Proses Video</button>
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

      <div className="foot">status-hd · pemrosesan lokal via ffmpeg.wasm</div>
    </div>
  );
}
