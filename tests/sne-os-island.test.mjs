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
const html = read("src/workspace.html");
const css = read("src/sne-os-island.css");
for (const token of ["#sne-os-world", "#setting-sne-os-world", "#sne-os-rpg", "#sne-os-rpg-frame"]) {
  assert.ok(sceneSource.includes(token), "Missing JS reference: " + token);
}
for (const token of ['id="sne-os-world"', 'id="setting-sne-os-world"', 'id="sne-os-rpg"', 'id="sne-os-rpg-frame"', 'src="sne-os-island.js"', 'href="sne-os-island.css"']) {
  assert.ok(html.includes(token), "Missing desktop integration: " + token);
}
assert.ok(css.includes(".workspace") && css.includes("background: transparent"), "Background must remain behind editable frames");
for (const id of ['id="sne-os-zoom-in"', 'id="sne-os-zoom-out"']) {
  assert.ok(html.includes(id), "Missing visible zoom control: " + id);
}
assert.ok(sceneSource.includes("intersectObject(model, true)"), "The island mesh must support click-to-inspect");
assert.ok(sceneSource.includes("if (clicked) zoomIn();"), "Island click must zoom instead of launching the 2D game");
assert.ok(!sceneSource.includes("if (clicked) openGame();"), "Island click must never open the 2D game");
assert.ok(sceneSource.includes('zoomInButton?.addEventListener("click", zoomIn);'), "Plus zoom control must be wired");
assert.ok(sceneSource.includes('zoomOutButton?.addEventListener("click", zoomOut);'), "Minus zoom control must be wired");
assert.ok(sceneSource.includes('enterButton?.addEventListener("click", openGame);'), "Existing 2D game must have a separate explicit launch");
assert.ok(world.camera.minDistance < 2 && world.camera.maxDistance > 40, "Close inspection and distant overview must both be possible");
assert.ok(css.includes("pointer-events: none") && css.includes(".workspace > * { pointer-events: auto; }"), "Blank desktop area must pass pointer events to the island without disabling foreground windows");
assert.ok(sceneSource.includes("GLTFLoader"), "The real 3D island must be rendered as a model");
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
