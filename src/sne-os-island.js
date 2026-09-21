/* SNE:OS v0.1 — a real, locally rendered floating world behind actual desktop frames.
 * The model and routes are data-driven in sne-os-world.json. No document content
 * is handed to the world, and the RPG remains a separate optional presentation.
 */
import * as THREE from "./vendor/sne-os/three.module.js";
import { GLTFLoader } from "./vendor/sne-os/GLTFLoader.js";
import { safeOrbit, orbitAt, clampNumber } from "./sne-os-light-orbit.mjs";

const SETTINGS_KEY = "sne-os.floating-world.enabled.v1";
const LIGHT_SETTINGS_KEY = "sne-os.celestial-light.v1";
const host = document.querySelector("#sne-os-world");
const workspace = document.querySelector("#workspace");
const enableInput = document.querySelector("#setting-sne-os-world");
const settingsStatus = document.querySelector("#sne-os-settings-status");
const worldStatus = document.querySelector("#sne-os-world-status");
const enterButton = document.querySelector("#sne-os-enter-world");
const zoomInButton = document.querySelector("#sne-os-zoom-in");
const zoomOutButton = document.querySelector("#sne-os-zoom-out");
const resetButton = document.querySelector("#sne-os-reset-view");
const skipButton = document.querySelector("#sne-os-skip-reveal");
const retryButton = document.querySelector("#sne-os-retry");
const lightStatus = document.querySelector("#sne-os-light-status");
const lightInputs = ["x","y","z","duration","clearance","moon"].map(name => document.querySelector(`#sne-os-light-${name}`));
const applyLightButton = document.querySelector("#sne-os-light-apply");
const resetLightButton = document.querySelector("#sne-os-light-reset");
const dialog = document.querySelector("#sne-os-rpg");
const returnButton = document.querySelector("#sne-os-return");
const gameFrame = document.querySelector("#sne-os-rpg-frame");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let wanted = false;
let token = 0;
let session = null;
let worldDefinition = null;
let skipIntroRequested = false;
let lightOverrides = null;
try {
  const saved = JSON.parse(localStorage.getItem(LIGHT_SETTINGS_KEY) || "null");
  if (saved && typeof saved === "object" && !Array.isArray(saved)) lightOverrides = saved;
} catch {}

function activeLightSettings(definition) {
  return { ...definition.lighting.primary, ...(lightOverrides || {}) };
}

function updateLightControls(definition) {
  if (!definition || lightInputs.some(input => !input)) return;
  const light = activeLightSettings(definition);
  const values = [...light.startPosition, light.orbitDurationMs / 1000,
    light.clearance, light.moonIntensityFactor];
  lightInputs.forEach((input, index) => { input.value = String(values[index]); });
}

function updateCelestialLight(s) {
  if (!s.orbit) return;
  const current = orbitAt(s.orbit, s.orbitElapsedMs);
  s.sun.position.set(...current.position);
  const moonTransition = ease(clamp((s.orbitElapsedMs - s.orbit.periodMs) / 1300, 0, 1));
  s.sun.color.copy(s.sunColor).lerp(s.moonColor, moonTransition);
  s.sun.intensity = s.definition.appearance.sunIntensity *
    (1 - moonTransition * (1 - s.orbit.moonIntensityFactor));
  s.ambient.intensity = s.definition.appearance.ambientIntensity * (1 - moonTransition * 0.5);
  if (s.lastCelestialMode !== current.mode) {
    s.lastCelestialMode = current.mode;
    if (lightStatus) lightStatus.textContent = current.mode === "moon"
      ? "One complete orbit finished: the invisible light is now moonlight."
      : "Sunlight begins from your selected position and safely circles the whole island.";
  }
}

function applyLightSettings() {
  if (!worldDefinition || lightInputs.some(input => !input)) return;
  const defaults = worldDefinition.lighting.primary;
  const numbers = lightInputs.map(input => Number(input.value));
  if (numbers.some((n,i) => lightInputs[i].value.trim() === "" || !Number.isFinite(n))) {
    if (lightStatus) lightStatus.textContent = "Enter valid numeric values for each light control.";
    return;
  }
  lightOverrides = {
    startPosition: numbers.slice(0,3).map((n,i) => clampNumber(n, -100000, 100000, defaults.startPosition[i])),
    orbitDurationMs: clampNumber(numbers[3] * 1000, 4000, 3600000, defaults.orbitDurationMs),
    clearance: clampNumber(numbers[4], 1, 2000, defaults.clearance),
    moonIntensityFactor: clampNumber(numbers[5], 0.05, 1, defaults.moonIntensityFactor)
  };
  try { localStorage.setItem(LIGHT_SETTINGS_KEY, JSON.stringify(lightOverrides)); } catch {}
  updateLightControls(worldDefinition);
  if (session) {
    session.orbit = safeOrbit(activeLightSettings(worldDefinition), session.worldRadius);
    session.orbitElapsedMs = 0;
    session.lastCelestialMode = null;
    if (session.revealStage === "idle") updateCelestialLight(session);
    else session.sun.position.set(...orbitAt(session.orbit,0).position);
    renderOnce();
  }
  const safety = session?.orbit || safeOrbit(activeLightSettings(worldDefinition));
  if (lightStatus) lightStatus.textContent =
    `Orbit applied: radius ${safety.radius.toFixed(1)} (minimum safe ${safety.minRadius.toFixed(1)}). Full circle ${(safety.periodMs / 1000).toFixed(0)}s, then moonlight. Source hidden.`;
}

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

/* Stars and shooting stars live in the tiny, synchronous bootstrap so a slow
 * GLB download or blocked WebGL initialization never causes a blank canvas. */
function ease(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function placeCamera(s) {
  s.camera.position.set(0, s.distance * s.definition.camera.verticalAngle, s.distance);
  s.camera.lookAt(0, 0, 0);
  if (s.sun && s.definition.reveal?.lightDirection === "camera") {
    if (s.orbit) s.sun.position.set(...orbitAt(s.orbit, s.orbitElapsedMs || 0).position);
  }
}

/* This first pass couples a material-darkness coating to the rising invisible
 * light. The user's imported GLB contains unlit materials: merely ramping a
 * directional light would NOT reveal its colors. Tinting copies of materials
 * makes both lit and unlit meshes participate while preserving original maps.
 * A later spatial shader can implement a true per-pixel light-front wipe. */
function setRevealStrength(s, strength) {
  const amount = ease(strength);
  s.sun.intensity = s.definition.appearance.sunIntensity * amount;
  s.ambient.intensity = s.definition.appearance.ambientIntensity * amount;
  for (const item of s.revealMaterials) {
    const local = ease(clamp((amount - item.offset * 0.12) / 0.88, 0, 1));
    const tint = 0.018 + local * 0.982;
    if (item.color) item.material.color.copy(item.color).multiplyScalar(tint);
    if (item.emissive) item.material.emissive.copy(item.emissive).multiplyScalar(local);
  }
}

function finishReveal(s = session) {
  if (!s || s.revealStage === "idle") return;
  s.model.visible = true;
  s.revealStage = "idle";
  setRevealStrength(s, 1);
  s.orbitElapsedMs = 0;
  updateCelestialLight(s);
  if (skipButton) skipButton.hidden = true;
  status("Drag to rotate · Click or scroll to zoom · Use + / − to inspect Otherworld.");
  renderOnce();
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
  const intro = s.definition.reveal || {};
  if (s.revealStage !== "idle") {
    if (reducedMotion.matches || skipIntroRequested) {
      finishReveal(s);
    } else if (s.revealStage === "stars" &&
               timestamp >= s.bootAt + (intro.starfieldMinimumMs || 2600)) {
      s.model.visible = true;
      s.revealStage = "silhouette";
      s.revealStarted = timestamp;
      status("Otherworld emerging from the stars…");
    } else if (s.revealStage === "silhouette" &&
               timestamp - s.revealStarted >= (intro.silhouetteHoldMs || 750)) {
      s.revealStage = "approach";
      s.approachStarted = timestamp;
      status("Approaching the shadowed world…");
    } else if (s.revealStage === "approach") {
      const fraction = ease((timestamp - s.approachStarted) / (intro.approachMs || 1150));
      s.distance = s.definition.camera.initialDistance *
        (1 - (1 - (intro.approachFactor || 0.88)) * fraction);
      placeCamera(s);
      if (fraction >= 1) {
        s.revealStage = "light";
        s.lightStarted = timestamp;
        status("The light slowly reveals Otherworld…");
      }
    } else if (s.revealStage === "light") {
      const fraction = clamp((timestamp - s.lightStarted) / (intro.lightRevealMs || 3400), 0, 1);
      setRevealStrength(s, fraction);
      if (fraction >= 1) finishReveal(s);
    }
  }
  if (!reducedMotion.matches) {
    if (!s.dragging) s.pivot.rotation.y += dt * s.definition.motion.idleRotationRadiansPerSecond;
    s.pivot.position.y = Math.sin(timestamp / 1900) * s.definition.motion.bobAmplitude;
    if (s.revealStage === "idle") {
      s.orbitElapsedMs += dt * 1000;
      updateCelestialLight(s);
      s.mixer?.update(dt);
    }
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

function setZoom(nextDistance) {
  if (!session) return;
  const s = session;
  finishReveal(s);
  s.distance = clamp(nextDistance, s.definition.camera.minDistance, s.definition.camera.maxDistance);
  placeCamera(s);
  renderOnce();
}

function zoomIn() {
  if (session) setZoom(session.distance * 0.79);
}

function zoomOut() {
  if (session) setZoom(session.distance / 0.79);
}

function resetView() {
  if (!session) return;
  const s = session;
  s.dragging = false;
  s.pivot.rotation.set(0, 0, 0);
  setZoom(s.definition.camera.initialDistance);
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
    finishReveal(s);
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
    // Clicking a landmark-sized piece of the island is for inspection, not entering the RPG.
    if (clicked) zoomIn();
  });
  const cancel = () => { down = null; s.dragging = false; };
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("lostpointercapture", cancel);
  canvas.addEventListener("wheel", event => {
    if (!session || !wanted) return;
    event.preventDefault();
    setZoom(s.distance * Math.exp(event.deltaY * 0.001));
  }, { passive: false });
  canvas.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " " || event.key === "+" || event.key === "=" || event.key === "Add") { event.preventDefault(); zoomIn(); }
    else if (event.key === "-" || event.key === "_" || event.key === "Subtract") { event.preventDefault(); zoomOut(); }
  });
}

async function startWorld() {
  const myToken = ++token;
  clearSession();
  setWorldAppearance(true);
  if (retryButton) retryButton.hidden = true;
  if (skipButton) skipButton.hidden = false;
  status("Stars emerging… Loading Otherworld in the background.");
  let renderer;
  let canvas;
  try {
    const definition = await getDefinition();
    if (myToken !== token || !wanted) return;
    updateLightControls(definition);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, definition.appearance.maxPixelRatio));
    renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setClearColor(0x000000, 0); // Transparent canvas: the independent night sky stays visible.
    canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Rotatable SNE:OS island. Drag to turn; scroll, click, or press plus and minus to zoom. The 2D world has a separate entry control.");
    canvas.title = "Drag to rotate · Scroll or click island to zoom · Plus / minus zoom controls";
    host.prepend(canvas);
    const scene = new THREE.Scene();
    scene.background = null;
    const ambient = new THREE.HemisphereLight(0xe6f1ff, 0x363b48, 0);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffebcb, 0);
    sun.position.set(...definition.appearance.sunPosition);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(43, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 140);
    const pivot = new THREE.Group();
    scene.add(pivot);
    const gltf = await new GLTFLoader().loadAsync(new URL(definition.asset, import.meta.url).href);
    if (myToken !== token || !wanted) {
      renderer.dispose();
      canvas.remove();
      return;
    }
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    if (bounds.isEmpty()) throw new Error("Otherworld has no usable geometry.");
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
    const worldRadius = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere()).radius;
    const orbit = safeOrbit(activeLightSettings(definition), worldRadius);
    // The uploaded Stronghold stores its actual painted colors in EMISSIVE maps
    // while all ten materials advertise KHR_materials_unlit and zero baseColor.
    // Basic/unlit materials ignore directional sunlight entirely. Rebuild them as
    // physically lit PBR materials using their baked color textures as diffuse
    // maps, preserving alpha and skinning on the original mesh objects.
    const materialDefinitions = gltf.parser.json.materials || [];
    const sourceMaterialAssociations = gltf.parser.associations;
    const preparedMaterials = await Promise.all(materialDefinitions.map(async originalDefinition => {
      if (!originalDefinition.extensions?.KHR_materials_unlit) return null;
      const colorIndex = originalDefinition.emissiveTexture?.index ??
        originalDefinition.pbrMetallicRoughness?.baseColorTexture?.index;
      let colorMap = null;
      if (Number.isInteger(colorIndex)) {
        colorMap = (await gltf.parser.getDependency("texture", colorIndex)).clone();
        colorMap.colorSpace = THREE.SRGBColorSpace;
        colorMap.needsUpdate = true;
      }
      return new THREE.MeshStandardMaterial({
        name: originalDefinition.name || "Otherworld illuminated surface",
        map: colorMap,
        color: 0xffffff, // GLB baseColor is [0,0,0]; don't multiply away texture colors.
        roughness: 0.88,
        metalness: 0.02,
        transparent: originalDefinition.alphaMode === "BLEND",
        alphaTest: originalDefinition.alphaMode === "MASK" ?
          (originalDefinition.alphaCutoff ?? 0.5) : 0,
        depthWrite: originalDefinition.alphaMode !== "BLEND",
        side: originalDefinition.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
        // The lighting now acts on actual normals, with only a tiny ambient fill.
        emissive: 0x000000
      });
    }));
    if (myToken !== token || !wanted) {
      renderer.dispose();
      canvas.remove();
      return;
    }
    const revealMaterials = [];
    model.traverse(object => {
      if (!object.isMesh || !object.material) return;
      const original = Array.isArray(object.material) ? object.material : [object.material];
      const materialCopies = original.map(originalMaterial => {
        const associatedIndex = sourceMaterialAssociations?.get(originalMaterial)?.materials;
        const index = Number.isInteger(associatedIndex) ? associatedIndex :
          materialDefinitions.findIndex(definition => definition.name === originalMaterial.name);
        const material = preparedMaterials[index]?.clone() || originalMaterial.clone();
        const color = material.color?.clone() || null;
        const emissive = material.emissive?.clone() || null;
        const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
        const offset = clamp((center.x - bounds.min.x) / Math.max(0.001, size.x), 0, 1);
        revealMaterials.push({ material, color, emissive, offset });
        return material;
      });
      object.material = Array.isArray(object.material) ? materialCopies : materialCopies[0];
    });
    pivot.add(model);
    model.visible = false;
    const mixer = gltf.animations?.length ? new THREE.AnimationMixer(model) : null;
    if (mixer) for (const clip of gltf.animations) mixer.clipAction(clip).play();
    const distance = definition.camera.initialDistance;
    session = {
      renderer, canvas, scene, camera, pivot, model, definition, ambient, sun,
      orbit, worldRadius, orbitElapsedMs:0, lastCelestialMode:null,
      sunColor:new THREE.Color(definition.lighting.primary.sunColor),
      moonColor:new THREE.Color(definition.lighting.primary.moonColor),
      bootAt: window.SNE_OS_BOOT_AT || performance.now(),
      mixer, revealMaterials, revealStage: "stars", revealStarted: 0,
      approachStarted: 0, lightStarted: 0,
      distance, raycaster: new THREE.Raycaster(), animationFrame: 0,
      dragging: false, lastTimestamp: 0
    };
    placeCamera(session);
    setRevealStrength(session, 0);
    if (lightStatus) lightStatus.textContent = `Orbit minimum safe radius ${orbit.minRadius.toFixed(1)}; actual ${orbit.radius.toFixed(1)}. The light body stays invisible.`;
    attachPointerControls(session);
    resize();
    scheduleAnimation();
    status("Stars emerging… Otherworld is ready for its shadow reveal.");
  } catch (error) {
    console.error("SNE:OS Otherworld could not initialize:", error);
    if (session) clearSession();
    else { canvas?.remove(); renderer?.dispose(); }
    if (myToken !== token || !wanted) return;
    // Keep the self-running night sky and the actual desktop accessible.
    // Do not silently disable the user's preference after a transient startup failure.
    if (skipButton) skipButton.hidden = true;
    if (retryButton) retryButton.hidden = false;
    status("Otherworld could not load. The night sky and your desktop are still available. Choose Retry island.");
  }
}

function setEnabled(enabled) {
  wanted = enabled;
  skipIntroRequested = false;
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
  zoomInButton?.addEventListener("click", zoomIn);
  zoomOutButton?.addEventListener("click", zoomOut);
  resetButton?.addEventListener("click", resetView);
  applyLightButton?.addEventListener("click", applyLightSettings);
  resetLightButton?.addEventListener("click", () => {
    lightOverrides = null;
    try { localStorage.removeItem(LIGHT_SETTINGS_KEY); } catch {}
    if (worldDefinition) { updateLightControls(worldDefinition); applyLightSettings(); }
  });
  skipButton?.addEventListener("click", () => { skipIntroRequested = true; finishReveal(); });
  retryButton?.addEventListener("click", () => { if (wanted) void startWorld(); });
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
