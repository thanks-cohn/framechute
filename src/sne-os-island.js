/* SNE:OS v0.1 — a real, locally rendered floating world behind actual desktop frames.
 * The model and routes are data-driven in sne-os-world.json. No document content
 * is handed to the world, and the RPG remains a separate optional presentation.
 */
import * as THREE from "./vendor/sne-os/three.module.js";
import { GLTFLoader } from "./vendor/sne-os/GLTFLoader.js";

const SETTINGS_KEY = "sne-os.floating-world.enabled.v1";
const host = document.querySelector("#sne-os-world");
const workspace = document.querySelector("#workspace");
const enableInput = document.querySelector("#setting-sne-os-world");
const settingsStatus = document.querySelector("#sne-os-settings-status");
const worldStatus = document.querySelector("#sne-os-world-status");
const enterButton = document.querySelector("#sne-os-enter-world");
const resetButton = document.querySelector("#sne-os-reset-view");
const dialog = document.querySelector("#sne-os-rpg");
const returnButton = document.querySelector("#sne-os-return");
const gameFrame = document.querySelector("#sne-os-rpg-frame");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let wanted = false;
let token = 0;
let session = null;
let worldDefinition = null;

function status(message) {
  if (worldStatus) worldStatus.textContent = message;
  if (settingsStatus) settingsStatus.textContent = message;
}

async function getDefinition() {
  if (worldDefinition) return worldDefinition;
  const response = await fetch(new URL("./sne-os-world.json", import.meta.url));
  if (!response.ok) throw new Error("Could not load SNE:OS world definition.");
  const definition = await response.json();
  if (definition.schemaVersion !== 1 ||
      typeof definition.asset !== "string" ||
      !Array.isArray(definition.destinations) ||
      !definition.destinations.some(item => item.type === "embedded-page")) {
    throw new Error("The island's world definition is invalid.");
  }
  worldDefinition = definition;
  return definition;
}

function clearSession() {
  if (!session) return;
  const old = session;
  session = null;
  if (old.animationFrame) cancelAnimationFrame(old.animationFrame);
  old.canvas.remove();
  old.scene.traverse(object => {
    object.geometry?.dispose?.();
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const property of Object.values(material)) {
        if (property?.isTexture) property.dispose();
      }
      material.dispose();
    }
  });
  old.renderer.dispose();
}

function setWorldAppearance(enabled) {
  document.body.classList.toggle("sne-os-world-active", enabled);
  workspace.classList.toggle("sne-os-world-active", enabled);
  host.hidden = !enabled;
}

function stopWorld() {
  token++;
  clearSession();
  setWorldAppearance(false);
  status("Classic desktop active.");
}

function createStars(scene, count) {
  let seed = 4729107;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stars = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const longitude = rand() * Math.PI * 2;
    const latitude = Math.acos(rand() * 2 - 1);
    const radius = 45 + rand() * 10;
    stars[i * 3] = radius * Math.sin(latitude) * Math.cos(longitude);
    stars[i * 3 + 1] = radius * Math.cos(latitude);
    stars[i * 3 + 2] = radius * Math.sin(latitude) * Math.sin(longitude);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xb7d1f9, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.78, depthWrite: false
  }));
  scene.add(points);
}

function renderOnce() {
  if (!session || !wanted || host.hidden) return;
  const { renderer, scene, camera } = session;
  renderer.render(scene, camera);
}

function resize() {
  if (!session) return;
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  session.camera.aspect = width / height;
  session.camera.updateProjectionMatrix();
  session.renderer.setSize(width, height, false);
  renderOnce();
}

function animate(timestamp) {
  if (!session) return;
  const s = session;
  s.animationFrame = 0;
  if (!wanted || document.hidden || dialog.open || host.hidden) return;
  const dt = Math.min(0.05, Math.max(0, (timestamp - (s.lastTimestamp || timestamp)) / 1000));
  s.lastTimestamp = timestamp;
  if (!reducedMotion.matches) {
    if (!s.dragging) s.pivot.rotation.y += dt * s.definition.motion.idleRotationRadiansPerSecond;
    s.pivot.position.y = Math.sin(timestamp / 1900) * s.definition.motion.bobAmplitude;
  } else {
    s.pivot.position.y = 0;
  }
  renderOnce();
  s.animationFrame = requestAnimationFrame(animate);
}

function scheduleAnimation() {
  if (!session || session.animationFrame || !wanted || host.hidden || document.hidden || dialog.open) return;
  session.lastTimestamp = 0;
  session.animationFrame = requestAnimationFrame(animate);
}

function resetView() {
  if (!session) return;
  const s = session;
  s.dragging = false;
  s.pivot.rotation.set(0, 0, 0);
  s.distance = s.definition.camera.initialDistance;
  s.camera.position.set(0, s.distance * s.definition.camera.verticalAngle, s.distance);
  s.camera.lookAt(0, 0, 0);
  renderOnce();
}

function openGame() {
  if (!session || !wanted || dialog.open) return;
  const destination = session.definition.destinations.find(item => item.type === "embedded-page");
  if (!destination) return;
  const target = new URL(destination.page, import.meta.url);
  // Only this extension's own packaged playable prototype is permitted.
  if (target.origin !== window.location.origin || !target.pathname.includes("/experiments/first-playable-attempt-v0/")) {
    status("This destination is not a packaged local game.");
    return;
  }
  gameFrame.src = target.href;
  dialog.showModal();
  if (session?.animationFrame) {
    cancelAnimationFrame(session.animationFrame);
    session.animationFrame = 0;
  }
  returnButton.focus({ preventScroll: true });
}

function closeGame() {
  if (dialog.open) dialog.close();
}

function isModelHit(event) {
  if (!session) return false;
  const { canvas, raycaster, camera, model } = session;
  const rect = canvas.getBoundingClientRect();
  const position = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(position, camera);
  return raycaster.intersectObject(model, true).length > 0;
}

function attachPointerControls(s) {
  const { canvas } = s;
  let down = null;
  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !session || dialog.open) return;
    down = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
    s.dragging = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!down || down.id !== event.pointerId || !session) return;
    const dx = event.clientX - down.x, dy = event.clientY - down.y;
    if (Math.abs(event.clientX - down.startX) + Math.abs(event.clientY - down.startY) > 6) down.moved = true;
    if (down.moved) {
      s.pivot.rotation.y += dx * 0.008;
      s.pivot.rotation.x = clamp(s.pivot.rotation.x + dy * 0.003, -0.38, 0.38);
      renderOnce();
    }
    down.x = event.clientX;
    down.y = event.clientY;
  });
  canvas.addEventListener("pointerup", event => {
    if (!down || down.id !== event.pointerId) return;
    const clicked = !down.moved && isModelHit(event);
    down = null;
    s.dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (clicked) openGame();
  });
  const cancel = () => { down = null; s.dragging = false; };
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("lostpointercapture", cancel);
  canvas.addEventListener("wheel", event => {
    if (!session || !wanted) return;
    event.preventDefault();
    s.distance = clamp(s.distance * Math.exp(event.deltaY * 0.001), s.definition.camera.minDistance, s.definition.camera.maxDistance);
    s.camera.position.set(0, s.distance * s.definition.camera.verticalAngle, s.distance);
    s.camera.lookAt(0, 0, 0);
    renderOnce();
  }, { passive: false });
  canvas.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openGame(); }
  });
}

async function startWorld() {
  const myToken = ++token;
  clearSession();
  setWorldAppearance(true);
  status("Loading your floating island…");
  let renderer;
  try {
    const definition = await getDefinition();
    if (myToken !== token || !wanted) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, definition.appearance.maxPixelRatio));
    renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setClearColor(definition.appearance.spaceColor, 1);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Rotatable SNE:OS island. Drag to turn, scroll to zoom, click the island or press Enter to explore.");
    canvas.title = "Drag to rotate · Scroll to zoom · Click island to enter the little world";
    host.prepend(canvas);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(definition.appearance.spaceColor);
    createStars(scene, definition.appearance.starCount);
    scene.add(new THREE.HemisphereLight(0xe6f1ff, 0x363b48, definition.appearance.ambientIntensity));
    const sun = new THREE.DirectionalLight(0xffebcb, definition.appearance.sunIntensity);
    sun.position.set(...definition.appearance.sunPosition);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(43, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 120);
    const pivot = new THREE.Group();
    scene.add(pivot);
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(new URL(definition.asset, import.meta.url).href);
    if (myToken !== token || !wanted) {
      renderer.dispose();
      canvas.remove();
      return;
    }
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) throw new Error("Island model has no usable geometry.");
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    const scale = 5.5 / longest;
    model.scale.multiplyScalar(scale);
    model.position.set(
      model.position.x * scale - center.x * scale,
      model.position.y * scale - center.y * scale,
      model.position.z * scale - center.z * scale
    );
    pivot.add(model);
    const distance = definition.camera.initialDistance;
    camera.position.set(0, distance * definition.camera.verticalAngle, distance);
    camera.lookAt(0, 0, 0);
    session = {
      renderer, canvas, scene, camera, pivot, model, definition,
      distance, raycaster: new THREE.Raycaster(), animationFrame: 0,
      dragging: false, lastTimestamp: 0
    };
    attachPointerControls(session);
    resize();
    scheduleAnimation();
    status("Drag to rotate · Scroll to zoom · Click the island to enter your 2D world.");
  } catch (error) {
    console.error("SNE:OS floating island could not initialize:", error);
    renderer?.dispose();
    stopWorld();
    wanted = false;
    enableInput.checked = false;
    try { localStorage.setItem(SETTINGS_KEY, "false"); } catch {}
    status("3D island unavailable; your classic desktop is still accessible.");
  }
}

function setEnabled(enabled) {
  wanted = enabled;
  enableInput.checked = enabled;
  try { localStorage.setItem(SETTINGS_KEY, String(enabled)); } catch {}
  if (!enabled) {
    closeGame();
    stopWorld();
  } else {
    void startWorld();
  }
}

if (host && workspace && enableInput && dialog && gameFrame) {
  enableInput.addEventListener("change", () => setEnabled(enableInput.checked));
  enterButton?.addEventListener("click", openGame);
  resetButton?.addEventListener("click", resetView);
  returnButton?.addEventListener("click", closeGame);
  dialog.addEventListener("close", () => {
    gameFrame.src = "about:blank";
    scheduleAnimation();
    session?.canvas.focus({ preventScroll: true });
  });
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && session?.animationFrame) {
      cancelAnimationFrame(session.animationFrame);
      session.animationFrame = 0;
    } else scheduleAnimation();
  });
  window.addEventListener("pagehide", () => { wanted = false; stopWorld(); });
  let saved = null;
  try { saved = localStorage.getItem(SETTINGS_KEY); } catch {}
  setEnabled(saved !== "false");
}
