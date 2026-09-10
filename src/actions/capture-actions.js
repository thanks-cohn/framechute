const status = document.querySelector("#status");

const announce = (message) => {
  if (status) status.textContent = message;
};

const result = (blob, name, kind) => {
  window.dispatchEvent(new CustomEvent("framechute:add-result-object", {
    detail: { blob, name, kind }
  }));
};

async function displayStream(audio = false) {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture is unavailable.");
  }
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio });
}

async function videoFrameFromStream(stream) {
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error("The selected source did not provide a video track.");

  // Chrome's ImageCapture path gives us an actual produced frame instead of
  // racing the first composited frame of a newly attached <video>.
  if ("ImageCapture" in window) {
    try {
      const bitmap = await new ImageCapture(track).grabFrame();
      if (bitmap?.width && bitmap?.height) return bitmap;
      bitmap?.close?.();
    } catch {
      // Fall through to the video element path.
    }
  }

  const video = document.createElement("video");
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  Object.assign(video.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "2px",
    height: "2px",
    pointerEvents: "none"
  });
  document.body.append(video);
  video.srcObject = stream;

  try {
    await video.play();

    if (!(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0)) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("The selected screen never produced a drawable frame."));
        }, 3000);
        const cleanup = () => {
          clearTimeout(timeout);
          video.removeEventListener("loadeddata", ready);
          video.removeEventListener("resize", ready);
        };
        const ready = () => {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
            cleanup();
            resolve();
          }
        };
        video.addEventListener("loadeddata", ready);
        video.addEventListener("resize", ready);
        ready();
      });
    }

    if (typeof video.requestVideoFrameCallback === "function") {
      await new Promise(resolve => video.requestVideoFrameCallback(() => resolve()));
    } else {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    video.pause();
    video.srcObject = null;
    video.remove();
  }
}

export async function captureScreenImage() {
  const stream = await displayStream(false);
  try {
    const frame = await videoFrameFromStream(stream);
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(frame, 0, 0);
    frame.close?.();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error("The screenshot could not be encoded.")), "image/png");
    });
    result(blob, `screenshot-${Date.now()}.png`, "image");
    announce("Screenshot added to the workspace.");
    return blob;
  } finally {
    stream.getTracks().forEach(track => track.stop());
  }
}

export async function recordCapture({ microphone = false } = {}) {
  let stream;
  if (microphone) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone capture is unavailable.");
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } else {
    stream = await displayStream(true);
  }

  const types = [
    microphone && "audio/webm;codecs=opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ].filter(Boolean);
  const mimeType = types.find(type => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  recorder.ondataavailable = event => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });
  recorder.start(1000);
  announce("Recording… click Stop recording when finished.");

  const stop = document.createElement("button");
  stop.type = "button";
  stop.className = "capture-stop";
  stop.textContent = "Stop recording";
  document.body.append(stop);
  stop.onclick = () => recorder.stop();
  stream.getTracks().forEach(track => {
    track.onended = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };
  });

  await stopped;
  stop.remove();
  stream.getTracks().forEach(track => track.stop());
  const type = recorder.mimeType || chunks[0]?.type || (microphone ? "audio/webm" : "video/webm");
  const blob = new Blob(chunks, { type });
  const kind = microphone ? "audio" : "video";
  result(blob, `${microphone ? "microphone" : "screen"}-${Date.now()}.webm`, kind);
  announce("Recording added to the workspace. Use Save As when ready.");
  return blob;
}

function registerCaptureButton(id, label, icon, action) {
  if (document.querySelector(`#${id}`)) return;
  const button = document.createElement("button");
  button.id = id;
  button.type = "button";
  button.textContent = label;
  button.dataset.toolbarIcon = icon;
  button.title = `${label} (permission is requested only now)`;
  button.onclick = () => action().catch(error => {
    announce(error.name === "NotAllowedError"
      ? "Capture was cancelled or not allowed."
      : error.message);
  });

  if (window.FrameChuteToolbarPager?.add) {
    window.FrameChuteToolbarPager.add(button);
  } else {
    window.FrameChuteToolbarPending ||= [];
    window.FrameChuteToolbarPending.push({
      item: button,
      mode: window.frameChuteAdvancedMode ? "advanced" : "classic"
    });
  }
}

registerCaptureButton("capture-screenshot", "Screenshot", "▣", () => captureScreenImage());
registerCaptureButton("capture-screen-record", "Record screen", "●", () => recordCapture());
registerCaptureButton("capture-microphone", "Record mic", "♪", () => recordCapture({ microphone: true }));
