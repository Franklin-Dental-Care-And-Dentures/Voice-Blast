
/* ====== PIN Gate ====== */
const ALLOWED_PINS = ["0824"];

const pinGate = document.getElementById('pinGate');
const pinInput = document.getElementById('pinInput');
const pinUnlock = document.getElementById('pinUnlock');
const pinClear = document.getElementById('pinClear');
const pinMsg = document.getElementById('pinMsg');

let pinAttempts = 0;
let pinLockedUntil = 0;

function showGate(show) {
  pinGate.style.display = show ? "flex" : "none";
  document.body.style.overflow = show ? "hidden" : "";
}
function softValidate(pin) {
  return !ALLOWED_PINS.length || ALLOWED_PINS.includes(String(pin).trim());
}
function lockout(ms) {
  pinLockedUntil = Date.now() + ms;
  pinMsg.textContent = `Too many attempts. Try again in ${(ms/1000)|0}s.`;
}
function tryUnlock() {
  if (Date.now() < pinLockedUntil) return;
  const pin = (pinInput.value || "").trim();
  if (!pin) { pinMsg.textContent = "Enter your PIN."; return; }

  if (softValidate(pin)) {
    showGate(false);
    pinMsg.textContent = "";
  } else {
    pinAttempts++;
    pinMsg.textContent = "Incorrect PIN.";
    if (pinAttempts >= 5) { pinAttempts = 0; lockout(30 * 1000); }
  }
}
pinUnlock.onclick = tryUnlock;
pinClear.onclick = () => { pinInput.value = ""; pinMsg.textContent = ""; };
showGate(true);

/* ====== Config ====== */
const WEBHOOK = "https://hook.us2.make.com/v1ts24nel5225ryo896lvd5mswb24m69";
const SECRET = "Secret123";

/* ====== Elements ====== */
const recBtn = document.getElementById('recBtn');
const stopBtn = document.getElementById('stopBtn');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const imagesInput = document.getElementById('images');
const thumbsEl = document.getElementById('thumbs');
const micDot = document.getElementById('micDot');
const barEl = document.getElementById('bar');
const dbText = document.getElementById('dbText');
const peakEl = document.getElementById('peak');
const previewEl = document.getElementById('preview');
const liveToggle = document.getElementById('livePreviewToggle');
const srSupportEl = document.getElementById('srSupport');

/* ====== Speech Recognition ====== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let recognition = null;
let interimTxt = "", finalTxt = "";

if (SR) {
  srSupportEl.textContent = "Supported in this browser.";
} else {
  srSupportEl.textContent = "Not supported in this browser. Try Chrome on desktop.";
  liveToggle.disabled = true;
}

function startRecognition() {
  if (!SR || !liveToggle.checked) return;
  interimTxt = ""; finalTxt = "";
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    interimTxt = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) {
        finalTxt += res[0].transcript + " ";
      } else {
        interimTxt += res[0].transcript;
      }
    }
    previewEl.value = (finalTxt + (interimTxt ? " " + interimTxt : "")).trim();
  };

  recognition.onerror = (e) => console.warn("SpeechRecognition error:", e.error);
  recognition.onend = () => {
    if (mediaRecorder && mediaRecorder.state === "recording" && liveToggle.checked) {
      try { recognition.start(); } catch {}
    }
  };

  try { recognition.start(); } catch (e) { console.warn(e); }
}
function stopRecognition() {
  try { recognition && recognition.stop(); } catch {}
  recognition = null;
}

/* ====== Audio Recording ====== */
let mediaRecorder, chunks = [], lastBlob = null, lastMime = null;
let stream = null;

function extFor(mime) {
  if (!mime) return "webm";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("aac")) return "aac";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/* ====== Volume Meter ====== */
let audioCtx = null, analyser = null, sourceNode = null, rafId = null;
function startMeter(s) {
  stopMeter();
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode = audioCtx.createMediaStreamSource(s);
  sourceNode.connect(analyser);

  micDot.classList.add('on');
  peakEl.style.display = '';

  const data = new Uint8Array(analyser.fftSize);
  let peak = 0, lastPeakAt = 0;

  const loop = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    const db = rms > 0 ? (20 * Math.log10(rms)) : -Infinity;
    const pct = Math.min(100, Math.max(0, Math.round(rms * 160)));

    barEl.style.width = pct + '%';
    dbText.textContent = (db === -Infinity) ? '–∞ dB' : `${db.toFixed(1)} dB`;

    const now = performance.now();
    if (pct > peak || (now - lastPeakAt) > 1500) {
      peak = pct;
      lastPeakAt = now;
    } else {
      peak = Math.max(0, peak - 0.4);
    }
    peakEl.style.left = `calc(${peak}% - 1px)`;

    rafId = requestAnimationFrame(loop);
  };
  loop();
}
function stopMeter() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  try { sourceNode && sourceNode.disconnect(); } catch {}
  try { analyser && analyser.disconnect(); } catch {}
  try { audioCtx && audioCtx.close(); } catch {}
  sourceNode = analyser = audioCtx = null;
  barEl.style.width = '0%';
  dbText.textContent = '– dB';
  micDot.classList.remove('on');
  peakEl.style.display = 'none';
}

/* ====== Image Handling ====== */
let imageBlobs = [];
function renderThumbs() {
  thumbsEl.innerHTML = "";
  imageBlobs.forEach((item, idx) => {
    const url = URL.createObjectURL(item.blob);
    const div = document.createElement('div');
    div.className = 'thumb';
    div.innerHTML = `<img src="${url}" alt="photo ${idx+1}"><button class="x" title="Remove">×</button>`;
    div.querySelector('.x').onclick = () => {
      imageBlobs.splice(idx, 1);
      renderThumbs();
    };
    thumbsEl.appendChild(div);
  });
}
async function maybeShrink(file, maxSide = 1600, quality = 0.85) {
  if (file.size < 1.5 * 1024 * 1024) {
    return new Blob([await file.arrayBuffer()], { type: file.type || 'image/jpeg' });
  }
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('decode-failed'));
      i.src = dataUrl;
    });
    const { width, height } = img;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, outW, outH);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    return blob || file;
  } catch {
    return file;
  }
}
imagesInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const room = Math.max(0, 10 - imageBlobs.length);
  const take = files.slice(0, room);
  for (const f of take) {
    const shrunk = await maybeShrink(f);
    const base = (f.name || 'photo').replace(/\.[^/.]+$/, '');
    const name = base + '.jpg';
    imageBlobs.push({ blob: shrunk, name });
  }
  renderThumbs();
});

/* ====== Controls ====== */
recBtn.onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    try { mediaRecorder = new MediaRecorder(stream); }
    catch (e) { mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); }
    lastMime = mediaRecorder.mimeType || null;

    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const type = chunks[0]?.type || lastMime || 'audio/webm';
      lastBlob = new Blob(chunks, { type });
      sendBtn.disabled = false;
      const seconds = Math.max(1, Math.round((lastBlob.size / 32000)));
      statusEl.textContent = `Recorded ~${seconds}s · ${(lastBlob.size/1024).toFixed(1)} KB (${type})`;
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
      stream = null;
      stopMeter();
    };

    mediaRecorder.start();
    recBtn.disabled = true; stopBtn.disabled = false; sendBtn.disabled = true;
    statusEl.textContent = "Recording…";
    startRecognition();
    startMeter(stream);
  } catch (e) {
    console.error(e);
    alert('Microphone permission is required. Please allow access.');
  }
};

stopBtn.onclick = () => {
  try { mediaRecorder?.stop(); } catch {}
  recBtn.disabled = false; stopBtn.disabled = true;
  statusEl.textContent = "Stopped. Ready to send.";
  stopRecognition();
  stopMeter();
  try { stream && stream.getTracks().forEach(t => t.stop()); } catch {}
  stream = null;
};

sendBtn.onclick = async () => {
  if (!lastBlob) return;
  statusEl.textContent = "Uploading…";
  const audience = document.getElementById('audience').value;
  const subject = document.getElementById('subject').value;
  const sender = (document.getElementById('sender').value || "").trim();
  const filename = `note.${extFor(lastBlob.type)}`;

  let transcript = (previewEl.value || "").trim();
  if (sender) transcript = transcript ? `${transcript}\n\n— ${sender}` : `— ${sender}`;

  const fd = new FormData();
  fd.append('audio', lastBlob, filename);
  fd.append('audience', audience);
  fd.append('subject', subject);
  fd.append('secret', SECRET);
  fd.append('sender', sender);
  fd.append('transcript', transcript);

  const names = [];
  for (let i = 0; i < imageBlobs.length; i++) {
    const { blob, name } = imageBlobs[i];
    const n = name || `image-${i+1}.jpg`;
    names.push(n);
    fd.append('images', blob, n);
    fd.append('images[]', blob, n);
  }
  fd.append('images_count', String(imageBlobs.length));
  fd.append('images_names', names.join(', '));

  try {
    const res = await fetch(WEBHOOK, { method: 'POST', body: fd });
    statusEl.textContent = res.ok ? "Sent to Make ✅" : "Sent (check Make) ✅";
  } catch (e) {
    statusEl.textContent = "Failed to send ❌ (see console)";
    console.error(e);
  }
};

resetBtn.onclick = () => {
  try { mediaRecorder?.stop(); } catch {}
  stopRecognition();
  stopMeter();
  try { stream && stream.getTracks().forEach(t => t.stop()); } catch {}
  stream = null;

  lastBlob = null; chunks = []; lastMime = null;
  previewEl.value = "";
  document.getElementById('subject').value = "";
  document.getElementById('sender').value = "";
  statusEl.textContent = "";

  imagesInput.value = "";
  imageBlobs = [];
  renderThumbs();

  recBtn.disabled = false;
  stopBtn.disabled = true;
  sendBtn.disabled = true;
};

liveToggle.addEventListener('change', () => {
  if (!liveToggle.checked) {
    stopRecognition();
  } else if (mediaRecorder && mediaRecorder.state === "recording") {
    startRecognition();
  }
});
