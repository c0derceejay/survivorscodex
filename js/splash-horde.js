/**
 * Splash horde — ~20 zombies walk toward the viewer in pseudo-3D.
 * Uses catalog zombie portraits. Optional MP4/WebM in videos/ replaces this.
 */
(function () {
  const HORDE_SIZE = 20;
  const ZOMBIE_IDS = [
    "zombie-steve", "zombie-arlene", "zombie-boe", "zombie-joe", "zombie-marlene",
    "zombie-darlene", "zombie-cop", "zombie-nurse", "zombie-biker", "zombie-spider",
    "zombie-screamer", "zombie-wight", "zombie-dog", "zombie-burnt", "zombie-hazmat",
    "zombie-lumberjack", "zombie-party-girl", "zombie-soldier", "zombie-thug", "mutated-zombie",
  ];

  const canvas = document.getElementById("splash-horde-canvas");
  const wrap = document.getElementById("splash-horde");
  const video = document.getElementById("splash-horde-video");
  const muteBtn = document.getElementById("splash-horde-mute");
  const muteLabel = muteBtn?.querySelector(".splash-horde-mute-label");
  const muteIcon = muteBtn?.querySelector(".splash-horde-mute-icon");
  if (!canvas || !wrap) return;

  const ICON_MUTED = `<path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`;
  const ICON_UNMUTED = `<path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`;

  const ctx = canvas.getContext("2d");
  const images = new Map();
  let walkers = [];
  let raf = 0;
  let running = false;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function loadImage(id) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ id, img, ok: true });
      img.onerror = () => resolve({ id, img: null, ok: false });
      img.src = `images/items/${id}.png`;
    });
  }

  function resize() {
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnWalker() {
    return {
      id: ZOMBIE_IDS[Math.floor(Math.random() * ZOMBIE_IDS.length)],
      x: (Math.random() - 0.5) * 1.6,
      z: Math.random() * 0.35,
      speed: 0.00055 + Math.random() * 0.00075,
      bob: Math.random() * Math.PI * 2,
      sway: Math.random() * Math.PI * 2,
    };
  }

  function initWalkers() {
    walkers = Array.from({ length: HORDE_SIZE }, spawnWalker);
  }

  function drawSilhouette(x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#1a1218";
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.15, size * 0.28, size * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - size * 0.22, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFrame(t) {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const horizon = h * 0.28;
    const ground = h * 0.98;

    ctx.clearRect(0, 0, w, h);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#08080a");
    sky.addColorStop(0.45, "#120a0c");
    sky.addColorStop(1, "#1a0808");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const fog = ctx.createRadialGradient(w * 0.5, horizon, 10, w * 0.5, ground, w * 0.75);
    fog.addColorStop(0, "rgba(214, 40, 40, 0.08)");
    fog.addColorStop(0.55, "rgba(80, 10, 10, 0.18)");
    fog.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, w, h);

    walkers.sort((a, b) => a.z - b.z);

    for (const walker of walkers) {
      walker.z += walker.speed;
      walker.bob += 0.07 + walker.z * 0.04;
      walker.sway += 0.025;

      if (walker.z > 1.05) {
        Object.assign(walker, spawnWalker(), { z: 0.02 });
      }

      const depth = walker.z * walker.z;
      const y = horizon + (ground - horizon) * depth;
      const spread = w * (0.12 + depth * 0.48);
      const x = w * 0.5 + walker.x * spread + Math.sin(walker.sway) * depth * 8;
      const size = 18 + depth * 140;
      const alpha = 0.35 + depth * 0.65;
      const bobY = Math.sin(walker.bob) * (2 + depth * 6);

      const entry = images.get(walker.id);
      if (entry?.ok) {
        const img = entry.img;
        const aspect = img.width / img.height || 1;
        const drawW = size;
        const drawH = size / aspect;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.filter = `brightness(${0.55 + depth * 0.35}) contrast(1.1) saturate(0.75)`;
        ctx.drawImage(img, x - drawW / 2, y - drawH + bobY, drawW, drawH);
        ctx.restore();
      } else {
        drawSilhouette(x, y + bobY, size, alpha);
      }
    }

    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.15, w * 0.5, h * 0.55, w * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    raf = requestAnimationFrame(drawFrame);
  }

  function startCanvas() {
    if (running) return;
    running = true;
    wrap.dataset.mode = "canvas";
    canvas.hidden = false;
    if (video) video.hidden = true;
    showAudioControl(false);
    resize();
    initWalkers();
    raf = requestAnimationFrame(drawFrame);
    window.addEventListener("resize", resize);
  }

  function stopCanvas() {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  }

  function updateMuteButton() {
    if (!muteBtn || !video) return;
    const isMuted = video.muted;
    muteBtn.setAttribute("aria-pressed", String(isMuted));
    muteBtn.setAttribute("aria-label", isMuted ? "Unmute hero video" : "Mute hero video");
    muteBtn.classList.toggle("is-unmuted", !isMuted);
    if (muteLabel) muteLabel.textContent = isMuted ? "Unmute" : "Mute";
    if (muteIcon) muteIcon.innerHTML = isMuted ? ICON_MUTED : ICON_UNMUTED;
  }

  function showAudioControl(show) {
    if (!muteBtn) return;
    muteBtn.hidden = !show;
  }

  let audioSetup = false;

  function setupAudioControls() {
    if (!video || !muteBtn || audioSetup) return;
    audioSetup = true;
    muteBtn.addEventListener("click", async () => {
      video.muted = !video.muted;
      if (!video.muted) {
        video.volume = 1;
        try {
          await video.play();
        } catch {
          video.muted = true;
        }
      }
      updateMuteButton();
    });

    video.addEventListener("volumechange", updateMuteButton);
    updateMuteButton();
  }

  async function tryVideo() {
    if (!video || prefersReducedMotion()) return false;

    video.hidden = false;
    canvas.hidden = true;
    wrap.dataset.mode = "video";
    video.muted = true;
    video.volume = 1;

    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        if (!ok) {
          video.hidden = true;
          canvas.hidden = false;
          wrap.dataset.mode = "canvas";
        } else {
          showAudioControl(true);
          setupAudioControls();
        }
        resolve(ok);
      };

      const timeout = setTimeout(() => done(false), 8000);

      video.addEventListener("canplay", async () => {
        try {
          await video.play();
          clearTimeout(timeout);
          done(true);
        } catch {
          clearTimeout(timeout);
          done(false);
        }
      }, { once: true });

      video.addEventListener("error", () => {
        clearTimeout(timeout);
        done(false);
      }, { once: true });

      if (video.readyState >= 2) {
        video.play().then(() => {
          clearTimeout(timeout);
          done(true);
        }).catch(() => {
          clearTimeout(timeout);
          done(false);
        });
        return;
      }

      video.load();
    });
  }

  async function boot() {
    if (prefersReducedMotion()) {
      wrap.dataset.mode = "static";
      canvas.hidden = true;
      return;
    }

    await Promise.all(ZOMBIE_IDS.map(loadImage)).then((loaded) => {
      loaded.forEach((entry) => images.set(entry.id, entry));
    });

    const hasVideo = await tryVideo();
    if (!hasVideo) startCanvas();
  }

  if (video) {
    video.addEventListener("error", () => {
      if (wrap.dataset.mode === "video") {
        video.hidden = true;
        startCanvas();
      }
    });
  }

  boot();
})();
