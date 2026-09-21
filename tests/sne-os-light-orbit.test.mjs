import assert from "node:assert/strict";
import { safeOrbit, orbitAt } from "../src/sne-os-light-orbit.mjs";
const near = (a,b,eps=1e-8) => Math.abs(a-b) < eps;
for (const startPosition of [
  [0,6,12], [11,2,0], [-16,9,-18], [-2,-4,8], [0,0,0], [0,0,-2]
]) {
  const o = safeOrbit({ startPosition, clearance: 3, orbitDurationMs: 12000 }, 4);
  assert.ok(o.radius >= 7, "Every starting position must be outside the whole world and clearance");
  const initial = orbitAt(o,0);
  assert.equal(initial.mode,"sun");
  for (let i=0;i<=120;i++) {
    const pos = orbitAt(o,i*100).position;
    assert.ok(Math.hypot(...pos) >= 7 - 1e-7,"No position on the complete orbit may approach the structures");
    assert.ok(near(Math.hypot(...pos),o.radius,1e-6),"The light must follow a proper circle");
  }
  const completed = orbitAt(o,12000);
  assert.equal(completed.mode,"moon","One full circle switches the source to moonlight");
  assert.equal(completed.completedOrbit,true);
  completed.position.forEach((value,i)=>assert.ok(near(value, initial.position[i]),"The first orbit must return to the exact starting bearing"));
  assert.equal(orbitAt(o,24000).mode,"moon","Moon mode persists on later circuits");
  assert.equal(o.visibleBody,false,"Default light body stays hidden");
}
const requested = [3,8,-11];
const o = safeOrbit({startPosition:requested, clearance:2,orbitDurationMs:28000},2);
const expectedAzimuth = Math.atan2(requested[0],requested[2]);
assert.ok(near(o.azimuth, expectedAzimuth), "User chooses the start bearing");
assert.ok(near(o.radius,Math.hypot(...requested)), "Safe user placement is preserved exactly");
assert.equal(safeOrbit({ startPosition:[1,1,1],clearance:5 },4).radius,9,
  "Unsafe close placements are pushed outside the world's bounding sphere");
console.log("PASS: user-selectable orbital start, every-point clearance, complete circle, invisible sun-to-moon phase.");
