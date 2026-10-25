/* Indoor routing: corridor graph (SIMULATED from the floor sketch), lift + stairs alternatives, turn-by-turn text, animated arrow path. */
import { X, Z } from "/3d/data.js";
const PTS = { e1: [425, 275], e2: [425, 540], e3: [425, 942], e4: [425, 1317], e5: [425, 1520], e6: [410, 1900], t2: [620, 540], c1: [910, 540], c2: [910, 1000], c3: [910, 1500], c4: [910, 1900],
  w1: [1000, 750], w2: [1000, 1000], w3: [1000, 1300], w4: [1000, 1550], s1: [1000, 1800], s2: [1200, 1800], h1: [1370, 1800], lm: [800, 1070], lb: [800, 1782], lw: [1340, 1870],
  st: [910, 480], sb: [850, 2000], sw: [1470, 1870], door: [910, 2150] };
const EDGES = "e1-e2 e2-e3 e3-e4 e4-e5 e4-e6 e2-t2 t2-c1 c1-c2 c2-c3 c3-c4 c1-w1 w1-w2 w2-w3 w3-w4 w4-s1 s1-s2 s2-h1 c2-w2 c3-w3 c4-s1 c2-lm c4-lb h1-lw h1-sw c1-st c4-sb sb-door c4-door".split(" ").map(e => e.split("-"));
const LIFTS = ["lm", "lb", "lw"], STAIRS = ["st", "sb", "sw"], M = 2.4;   // 1 world unit ~ 2.4 m (simulated)
const NAME = { lm: "the centre lift bank", lb: "the north lift", lw: "the west lift", st: "the south stairs", sb: "the north stairs", sw: "the west stairs" };
const EXIT = { lm: [-1, 0], lb: [-1, 0], lw: [0, 1], st: [0, -1], sb: [-1, 0], sw: [0, 1] };   // direction you face when you step out
const node = {}, adj = {};
Object.entries(PTS).forEach(([k, [u, v]]) => (node[k] = { x: X(u), z: Z(v) }));
EDGES.forEach(([a, b]) => { const d = Math.hypot(node[a].x - node[b].x, node[a].z - node[b].z); (adj[a] ||= []).push([b, d]); (adj[b] ||= []).push([a, d]); });
export const ENTRANCE = { floor: 0, name: "Main Entrance", cx: node.door.x, cz: node.door.z, door: null, heading: [0, 1], type: "facility", category: null, code: "", key: "main entrance" };
function dijkstra(from) {
  const dist = { [from]: 0 }, prev = {}, q = new Set(Object.keys(node));
  while (q.size) { let u = null; q.forEach(k => { if (dist[k] !== undefined && (u === null || dist[k] < dist[u])) u = k; }); if (u === null) break; q.delete(u);
    adj[u].forEach(([v, d]) => { if (dist[v] === undefined || dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; } }); }
  return { dist, prev };
}
const pathTo = (prev, to) => { const p = [to]; while (prev[p[0]]) p.unshift(prev[p[0]]); return p; };
const pt = r => (r.door ? { x: r.door.x, z: r.door.z } : { x: r.cx, z: r.cz });
const exitDir = r => { if (r === ENTRANCE) return ENTRANCE.heading; if (!r.door) return null; const dx = (r.door.x - r.cx) / (r.w / 2), dz = (r.door.z - r.cz) / (r.d / 2); return Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)]; };
function snap(r) {
  if (r === ENTRANCE) return "door"; const p = pt(r); let best = null, bd = 1e9;
  Object.keys(node).forEach(k => { if (NAME[k] || k === "door") return; const d = Math.hypot(node[k].x - p.x, node[k].z - p.z); if (d < bd) { bd = d; best = k; } }); return best;
}
function turn(h, d) {
  const a = Math.atan2(h[0] * d[1] - h[1] * d[0], h[0] * d[0] + h[1] * d[1]) * 180 / Math.PI;   // map is north-up: positive = clockwise = right
  return Math.abs(a) > 150 ? "Turn around" : a > 100 ? "Turn sharp right" : a > 25 ? "Turn right" : a < -100 ? "Turn sharp left" : a < -25 ? "Turn left" : "Continue straight";
}
function legSteps(pts, h0, floor) {
  const out = []; let h = h0, acc = 0, lab = null;
  const flush = () => { if (lab && acc > 0.3) out.push({ floor, text: `${lab}, walk ${Math.max(1, Math.round(acc * M))} m` }); acc = 0; };
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dz = pts[i].z - pts[i - 1].z, len = Math.hypot(dx, dz); if (len < 0.05) continue;
    const d = [dx / len, dz / len]; let t = h ? turn(h, d) : "Head straight"; if (lab === null && t === "Continue straight") t = "Go straight";
    if (lab === null || t !== "Continue straight") { flush(); lab = t; } acc += len; h = d;
  }
  flush(); return { steps: out, heading: h };
}
const fl = n => (n ? "floor " + n : "the ground floor"), plen = pts => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0), 0);
export function routes(a, b) {
  const A = snap(a), B = snap(b), fa = dijkstra(A), fb = dijkstra(B), pa = pt(a), pb = pt(b), ha = exitDir(a);
  const finish = (h, steps) => { const ih = exitDir(b); if (ih && h) { const t = turn(h, [-ih[0], -ih[1]]); steps.push({ floor: b.floor, text: `${t === "Continue straight" ? "Go straight into" : t + " into"} ${b.name}` }); } steps.push({ floor: b.floor, text: `You have arrived at ${b.name}` }); };
  const build = T => {
    const steps = [{ floor: a.floor, text: `Start at ${a.name} (${fl(a.floor)})${ha && a !== ENTRANCE ? ", step out through the door" : ""}` }]; let legs, vertical = 0;
    if (!T) { const pts = [pa, ...pathTo(fa.prev, B).map(k => node[k]), pb], r = legSteps(pts, ha, a.floor); steps.push(...r.steps); finish(r.heading, steps); legs = [{ floor: a.floor, pts }]; }
    else {
      const p1 = [pa, ...pathTo(fa.prev, T).map(k => node[k])], p2 = [...pathTo(fb.prev, T).reverse().map(k => node[k]), pb];
      const r1 = legSteps(p1, ha, a.floor), r2 = legSteps(p2, EXIT[T], b.floor), df = Math.abs(b.floor - a.floor), up = b.floor > a.floor ? "up" : "down", lift = LIFTS.includes(T);
      steps.push(...r1.steps, { floor: a.floor, text: lift ? `Enter ${NAME[T]} and go ${up} to ${fl(b.floor)}` : `Climb the stairs (${NAME[T]}) ${up} ${df} floor${df > 1 ? "s" : ""} to ${fl(b.floor)}` },
        { floor: b.floor, text: lift ? `Exit the lift on ${fl(b.floor)}` : `Leave the stairs on ${fl(b.floor)}` }, ...r2.steps); finish(r2.heading, steps);
      legs = [{ floor: a.floor, pts: p1 }, { floor: b.floor, pts: p2 }]; vertical = lift ? 0.6 : 0.15 * df;
    }
    const meters = Math.round(legs.reduce((s, l) => s + plen(l.pts), 0) * M);
    return { legs, steps, meters, minutes: Math.max(1, Math.round(meters / 72 + vertical)), via: !T ? "walk" : LIFTS.includes(T) ? "lift" : "stairs" };
  };
  if (a.floor === b.floor) return { walk: build(null) };
  const best = list => list.reduce((x, t) => (fa.dist[t] + fb.dist[t] < fa.dist[x] + fb.dist[x] ? t : x));
  return { lift: build(best(LIFTS)), stairs: build(best(STAIRS)) };
}
export function drawRoute(THREE, parent, R, FH) {
  const pts = []; R.legs.forEach(l => l.pts.forEach(p => { const v = new THREE.Vector3(p.x, l.floor * FH + 0.3, p.z); if (!pts.length || v.distanceTo(pts[pts.length - 1]) > 0.01) pts.push(v); }));
  const g = new THREE.Group(); parent.add(g); if (pts.length < 2) return { update() {}, dispose() { parent.remove(g); } };
  const path = new THREE.CurvePath(); pts.slice(1).forEach((p, i) => path.add(new THREE.LineCurve3(pts[i], p)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(path, pts.length * 8, 0.1, 6, false), new THREE.MeshBasicMaterial({ color: 0x00d9ff, depthTest: false })); tube.renderOrder = 10; g.add(tube);
  const N = Math.max(3, Math.min(80, Math.round(path.getLength() / 1.8))), up = new THREE.Vector3(0, 1, 0), am = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }), ag = new THREE.ConeGeometry(0.34, 0.8, 4);
  const arrows = Array.from({ length: N }, () => { const m = new THREE.Mesh(ag, am); m.renderOrder = 11; g.add(m); return m; });
  return { update(t) { arrows.forEach((m, i) => { const u = (((t * 0.08 + i / N) % 1) + 1) % 1; m.position.copy(path.getPointAt(u)); m.quaternion.setFromUnitVectors(up, path.getTangentAt(u)); }); }, dispose() { parent.remove(g); } };
}
