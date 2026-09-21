import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const world = JSON.parse(read("src/sne-os-world.json"));
assert.equal(world.schemaVersion, 1);
assert.ok(world.id && world.asset && world.appearance && world.camera);
assert.ok(world.destinations.length > 0);
const sceneSource = read("src/sne-os-island.js");
const bootSource = read("src/sne-os-boot.js");
assert.ok(world.asset.endsWith("/otherworld/the_last_stronghold_animated.glb"), "New Otherworld GLB must be active");
assert.equal(world.reveal.visibleLightBody, false, "Default light body must remain invisible");
assert.ok(world.reveal.starfieldMinimumMs > 1000, "Starfield stage must precede model arrival");
const html = read("src/workspace.html");
const css = read("src/sne-os-island.css");
for (const token of ["#sne-os-world", "#setting-sne-os-world", "#sne-os-rpg", "#sne-os-rpg-frame"]) {
  assert.ok(sceneSource.includes(token), "Missing JS reference: " + token);
}
for (const token of ['id="sne-os-world"', 'id="setting-sne-os-world"', 'id="sne-os-rpg"', 'id="sne-os-rpg-frame"', 'src="sne-os-island.js"', 'href="sne-os-island.css"']) {
  assert.ok(html.includes(token), "Missing desktop integration: " + token);
}
assert.ok(css.includes('html {\n  background-color: #000;'), "Root page under the world must default to black, even outside the scrollable workspace");
assert.ok(css.includes('body.sne-os-world-active[data-framechute-expandable-canvas="true"]') &&
          css.includes('body.sne-os-boot-pending[data-framechute-expandable-canvas="true"]'),
          "Expanded-scroll areas must stay black during boot and world mode");
assert.ok(css.includes('body.sne-os-world-active .workspace[data-expanded-origin="true"]') &&
          css.includes('background: #000 !important'),
          "The underlying workspace and its expanded origin must paint black, not a white browser canvas");
assert.ok(css.includes('scrollbar-color: #394657 #000'), "Root scrollbar track must be dark in world mode");
assert.ok(css.includes('#sne-os-world .sne-os-sky') && css.includes('background: radial-gradient'),
          "Decorative starfield must remain above the independently black default background");
for (const id of ['id="sne-os-zoom-in"', 'id="sne-os-zoom-out"']) {
  assert.ok(html.includes(id), "Missing visible zoom control: " + id);
}
assert.ok(sceneSource.includes("intersectObject(model, true)"), "The island mesh must support click-to-inspect");
assert.ok(sceneSource.includes("if (clicked) zoomIn();"), "Island click must zoom instead of launching the 2D game");
assert.ok(!sceneSource.includes("if (clicked) openGame();"), "Island click must never open the 2D game");
assert.ok(sceneSource.includes('zoomInButton?.addEventListener("click", zoomIn);'), "Plus zoom control must be wired");
assert.ok(sceneSource.includes('zoomOutButton?.addEventListener("click", zoomOut);'), "Minus zoom control must be wired");
assert.ok(sceneSource.includes('enterButton?.addEventListener("click", openGame);'), "Existing 2D game must have a separate explicit launch");
assert.ok(html.includes('id="sne-os-enter-world"') && html.includes('>Enter World</button>'), "Default entrance must be titled Enter World");
assert.ok(html.includes('id="sne-os-entry-label"') && html.includes('id="sne-os-entry-label-reset"'), "World entrance name must be configurable in settings");
assert.ok(sceneSource.includes('const ENTRY_LABEL_KEY = "sne-os.world.entry.label.v1"'), "Custom entrance title must be saved separately from destination");
assert.ok(sceneSource.includes("setWorldEntryLabel(savedEntryLabel, false)"), "Saved entrance title must be restored on startup");
assert.ok(html.includes('id="setting-sne-os-show-key"'), "World Key toggle must appear in settings");
const settingsSection = html.slice(html.indexOf('<div class="dock-body settings-body">'), html.indexOf('</aside>', html.indexOf('<div class="dock-body settings-body">')));
assert.ok(settingsSection.lastIndexOf('id="setting-sne-os-show-key"') > settingsSection.indexOf('id="archive-connect"'), "Show World Key must be at bottom of Settings");
assert.ok(html.includes('class="sne-os-hud" aria-label="World controls" hidden'), "World Key should be hidden by default");
assert.ok(css.includes('.sne-os-hud[hidden]') && css.includes('display: none !important'), "World Key hidden property must override HUD flex display");
assert.ok(sceneSource.includes('const SHOW_KEY_KEY = "sne-os.world.show-key.v1"'), "World Key preference must have its own saved setting");
assert.ok(sceneSource.includes('setWorldKeyVisible(savedShowKey, false)'), "Saved World Key preference must restore on reload");
assert.ok(sceneSource.includes('showKeyInput?.addEventListener("change"'), "World Key toggle must update live");
assert.ok(html.includes('id="sne-os-context-menu"') && html.includes('id="sne-os-context-enter"'), "Right-click Enter World menu must exist");
assert.ok(sceneSource.includes('host.addEventListener("contextmenu", openWorldMenu)'), "Right-click on island must open world menu");
assert.ok(sceneSource.includes('contextEnter?.addEventListener("click", openGame)'), "Right-click Enter World action must launch the existing world");
assert.ok(sceneSource.includes('contextEnter.textContent = clean'), "Customized entrance label must appear in context menu too");


assert.ok(world.camera.minDistance < 2 && world.camera.maxDistance > 40, "Close inspection and distant overview must both be possible");
assert.ok(css.includes("pointer-events: none") && css.includes(".workspace > * { pointer-events: auto; }"), "Blank desktop area must pass pointer events to the island without disabling foreground windows");
assert.ok(sceneSource.includes("GLTFLoader"), "The real 3D island must be rendered as a model");
assert.ok(html.includes('src="sne-os-boot.js"'), "Starfield must bootstrap independent of the renderer");
assert.ok(bootSource.includes("SNE_OS_BOOT_AT") && bootSource.includes("sne-os-meteor"), "Stars and shooting stars must launch before the model");
assert.ok(sceneSource.includes('alpha: true') && sceneSource.includes('scene.background = null'), "3D scene must not obscure the waiting starfield");
assert.ok(sceneSource.includes('revealStage === "light"'), "Light reveal stage must exist");
assert.ok(!sceneSource.includes('revealStage === "approach"') && !sceneSource.includes('revealStage === "silhouette"'),
  "Intro must not include automatic camera approach or separate silhouette hold");
assert.ok(!sceneSource.includes('s.distance = s.definition.camera.initialDistance *'),
  "Startup must not change the camera distance");
assert.equal(world.motion.idleRotationRadiansPerSecond, 0, "Default model must not rotate itself");
assert.equal(world.motion.bobAmplitude, 0, "Default model must not bob during reveal");
assert.ok(!Object.hasOwn(world.reveal,"approachMs") && !Object.hasOwn(world.reveal,"approachFactor"),
  "Camera intro approach must be removed from world configuration");
assert.ok(html.includes('class="sne-os-hud-footnote"'), "Explanatory status must appear as a bottom footnote");
const hud = html.slice(html.indexOf('class="sne-os-hud"'), html.indexOf('</div>\n    </section>', html.indexOf('class="sne-os-hud"')));
assert.ok(hud.indexOf('id="sne-os-enter-world"') < hud.indexOf('id="sne-os-world-status"'),
  "Buttons must precede the explanatory footer");
assert.ok(css.includes('flex-direction: column') && css.includes('"Lucida Console"'),
  "World controls should stack vertically with a legible retro monospace font");
assert.ok(sceneSource.includes("setRevealStrength(s, fraction)"), "Gradual illumination must be tied to reveal progress");
assert.ok(sceneSource.includes("Keep the self-running night sky"), "Failed GLB startup must preserve the safe night sky");
assert.ok(html.includes('id="sne-os-retry"') && html.includes('id="sne-os-skip-reveal"'), "Retry and skip must be available");
assert.ok(sceneSource.includes('dialog.showModal()'), "The existing 2D world must open without replacing workspace");
assert.ok(sceneSource.includes("localStorage.setItem(SETTINGS_KEY"), "The classic background toggle must persist");
const directory = resolve(root, "src");
const islandFile = resolve(directory, world.asset);
assert.ok(islandFile.startsWith(root + "/"), "Model must resolve within the project");
assert.ok(existsSync(islandFile), "Model file is missing: " + islandFile);
const b = readFileSync(islandFile);
assert.equal(b.toString("ascii", 0, 4), "glTF", "Model must be an actual GLB, not a screenshot");
assert.equal(b.readUInt32LE(4), 2, "Expected glTF 2.0");
assert.equal(b.readUInt32LE(8), b.length, "GLB length mismatch");
const glb = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));
const unlitMaterials = glb.materials?.filter(material => material.extensions?.KHR_materials_unlit) || [];
console.log("Otherworld materials:", JSON.stringify(glb.materials?.map(material => ({ name:material.name, unlit:!!material.extensions?.KHR_materials_unlit, baseColor:material.pbrMetallicRoughness?.baseColorFactor, hasTexture:!!material.pbrMetallicRoughness?.baseColorTexture, emissive:material.emissiveFactor, doubleSided:material.doubleSided }))));
console.log("Otherworld unlit material count:", unlitMaterials.length, "of", glb.materials?.length);
console.log("Otherworld material texture metadata:", JSON.stringify(glb.materials?.map(m => ({name:m.name,base:m.pbrMetallicRoughness?.baseColorTexture?.index,emissive:m.emissiveTexture?.index,normal:m.normalTexture?.index,strength:m.extensions?.KHR_materials_emissive_strength?.emissiveStrength}))));
console.log("Otherworld textures:",JSON.stringify(glb.textures));
console.log("Otherworld mesh attribute layouts:", JSON.stringify((glb.meshes || []).slice(0,6).map(mesh => mesh.primitives?.map(primitive => Object.keys(primitive.attributes || {})))));

for (const destination of world.destinations) {
  assert.equal(destination.type, "embedded-page");
  const target = resolve(directory, destination.page);
  assert.ok(target.startsWith(resolve(root, "experiments/first-playable-attempt-v0") + "/"), "Untrusted destination: " + target);
  assert.ok(existsSync(target), "Playable game is missing: " + target);
}
for (const dependency of ["src/vendor/sne-os/three.module.js", "src/vendor/sne-os/three.core.js", "src/vendor/sne-os/GLTFLoader.js", "src/vendor/sne-os/THREE-LICENSE"]) {
  assert.ok(existsSync(resolve(root, dependency)), "Missing locally vendored dependency: " + dependency);
}
console.log("PASS SNE:OS scene: real GLB, local renderer, clickable model, in-workspace RPG, classic fallback and metadata paths.");
