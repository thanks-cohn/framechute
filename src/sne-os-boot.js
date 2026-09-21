/* Lightweight starfield boots without waiting for Three.js or GLB decoding. */
(() => {
  const key = "sne-os.floating-world.enabled.v1";
  const host = document.querySelector("#sne-os-world");
  const workspace = document.querySelector("#workspace");
  let enabled = true;
  try { enabled = localStorage.getItem(key) !== "false"; } catch {}
  document.body.classList.remove("sne-os-boot-pending");
  if (!host || !workspace) return;
  if (enabled) {
    window.SNE_OS_BOOT_AT = performance.now();
    document.body.classList.add("sne-os-world-active");
    workspace.classList.add("sne-os-world-active");
    host.hidden = false;
  }
  const sky = document.createElement("div");
  sky.className = "sne-os-sky";
  sky.setAttribute("aria-hidden", "true");
  let seed = 1235813;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 96; i++) {
    const star = document.createElement("span");
    star.className = "sne-os-star";
    const size = random() < 0.15 ? 2 : 1;
    star.style.cssText = `left:${(random() * 98 + 1).toFixed(2)}%;top:${(random() * 96 + 2).toFixed(2)}%;width:${size}px;height:${size}px;--delay:${(0.15 + i * 0.027 + random() * 0.9).toFixed(2)}s;--shine:${(0.24 + random() * 0.52).toFixed(2)};`;
    sky.append(star);
  }
  for (let i = 0; i < 3; i++) {
    const meteor = document.createElement("span");
    meteor.className = "sne-os-meteor";
    meteor.style.cssText = `left:${(12 + random() * 72).toFixed(2)}%;top:${(6 + random() * 42).toFixed(2)}%;--delay:${(2.0 + i * 1.4 + random() * 0.65).toFixed(2)}s;`;
    sky.append(meteor);
  }
  host.prepend(sky);
})();