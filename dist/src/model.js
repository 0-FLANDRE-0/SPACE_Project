import { BASE_DAYS_PER_SECOND, BODY_BY_ID } from './data.js';

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
export const wrapAngle = angle => ((angle % TAU) + TAU) % TAU;

// Kepler ellipse in the local XZ plane; Y is height. Node and inclination
// transform the orbital plane, independently from the camera's projection.
export function orbitPosition(body, days = 0) {
  const mean = wrapAngle((body.phase ?? 0) * RAD + days / body.period * TAU);
  let eccentric = mean;
  const e = body.eccentricity ?? 0;
  for (let i = 0; i < 8; i++) eccentric -= (eccentric - e * Math.sin(eccentric) - mean) / (1 - e * Math.cos(eccentric));
  return orbitalPoint(body, eccentric);
}

export function orbitalPoint(body, eccentric) {
  const e = body.eccentricity ?? 0;
  const x = body.orbit * (Math.cos(eccentric) - e);
  const z = body.orbit * Math.sqrt(1 - e * e) * Math.sin(eccentric);
  const tilt = (body.inclination ?? 0) * RAD;
  const node = (body.node ?? 0) * RAD;
  const tiltedZ = z * Math.cos(tilt);
  return { x: x * Math.cos(node) - tiltedZ * Math.sin(node), y: z * Math.sin(tilt), z: x * Math.sin(node) + tiltedZ * Math.cos(node) };
}

export function worldPosition(id, days) {
  const body = BODY_BY_ID.get(id);
  if (!body || !body.orbit) return { x: 0, y: 0, z: 0 };
  const local = orbitPosition(body, days);
  if (!body.parent) return local;
  const parent = worldPosition(body.parent, days);
  return { x: parent.x + local.x, y: parent.y + local.y, z: parent.z + local.z };
}

export function orbitEmphasis(id, selectedId) {
  if (!selectedId) return .10;
  if (id === selectedId) return .90;
  const selection = BODY_BY_ID.get(selectedId);
  if (selection?.parent === id) return .32;
  if (BODY_BY_ID.get(id)?.parent === selectedId) return .28;
  return .055;
}

export class Simulation {
  days = 0;
  speed = 1;
  paused = false;
  selectedId = null;
  advance(realSeconds) {
    if (!Number.isFinite(realSeconds) || realSeconds < 0) return;
    if (!this.paused) this.days += realSeconds * BASE_DAYS_PER_SECOND * this.speed;
  }
  select(id) {
    if (id !== null && !BODY_BY_ID.has(id)) return false;
    this.selectedId = id;
    return true;
  }
}
