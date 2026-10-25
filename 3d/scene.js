/* Scene theme: cream buildings with window bands, grey roofs, green ground, trees, red-roofed temple, interior floor plans. */
import * as THREE from "three";
import { TYPES, LOBBIES, buildFloors } from "/3d/data.js";
import { CAMPUS, SPOTS, FOOTPATH } from "/3d/campus.js";
export const FH = 3, EW = 18, ED = 26, EX = -3;
const std = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
export function label(text, scale = 1, color = "#2b2118") {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d"); let fs = 46; g.font = `bold ${fs}px Arial`;
  while (g.measureText(text).width > 490 && fs > 18) g.font = `bold ${--fs}px Arial`;
  g.textAlign = "center"; g.lineWidth = 8; g.strokeStyle = "rgba(255,255,255,.95)"; g.strokeText(text, 256, 78); g.fillStyle = color; g.fillText(text, 256, 78);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false })); s.scale.set(7 * scale, 1.75 * scale, 1); return s;
}
let FT;
function facade() {
  if (FT) return FT; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  g.fillStyle = "#efe9dc"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#35506b"; g.fillRect(12, 14, 40, 26); g.fillStyle = "#8fb6d2"; g.fillRect(14, 16, 36, 10); g.fillStyle = "#d9b27c"; g.fillRect(0, 58, 64, 6);
  FT = new THREE.CanvasTexture(c); FT.colorSpace = THREE.SRGBColorSpace; FT.wrapS = FT.wrapT = THREE.RepeatWrapping; return FT;
}
function mats(w, d, floors, roof = 0x5a5f66) {
  const side = len => { const t = facade().clone(); t.needsUpdate = true; t.repeat.set(Math.max(1, Math.round(len / 4)), floors); return new THREE.MeshLambertMaterial({ map: t }); };
  return [side(d), side(d), std(roof), std(0xbfb8a8), side(w), side(w)];
}
const shadow = m => { m.castShadow = m.receiveShadow = true; return m; };
function roofTop(parent, w, d, y) {
  const trim = shadow(new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), std(0xd9b27c))); trim.position.y = y; parent.add(trim);
  [[-0.25, -0.2], [0.2, 0.25]].forEach(([a, b]) => { const u = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), std(0xf2f0ea))); u.position.set(a * w, y + 0.7, b * d); parent.add(u); });
}
function seg(parent, x1, z1, x2, z2, h = 1.1, t = 0.1, c = 0xf7f5ef) {
  const len = Math.hypot(x2 - x1, z2 - z1); if (len < 0.05) return;
  const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(len, h, t), std(c))); m.position.set((x1 + x2) / 2, h / 2 + 0.03, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); parent.add(m);
}
function roomWalls(parent, r) {
  const x0 = r.cx - r.w / 2, x1 = r.cx + r.w / 2, z0 = r.cz - r.d / 2, z1 = r.cz + r.d / 2, dr = r.door;
  [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]].forEach(([ax, az, bx, bz]) => {
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    if (dr) { const px = dr.x - ax, pz = dr.z - az, t = px * ux + pz * uz, off = Math.abs(px * uz - pz * ux);
      if (off < 0.2 && t > 0 && t < len) { const g = 0.55; seg(parent, ax, az, ax + ux * (t - g), az + uz * (t - g)); seg(parent, ax + ux * (t + g), az + uz * (t + g), bx, bz); return; } }
    seg(parent, ax, az, bx, bz);
  });
}
function furnish(parent, r) {
  const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o; };
  if (["class", "staff", "lab", "hr", "hall", "cell", "workshop"].includes(r.type)) {
    const cols = Math.max(2, Math.floor(r.w / 1.7)), rows = Math.max(1, Math.min(4, Math.floor(r.d / 1.9))), fw = r.w / (cols + 1), fd = r.d / (rows + 1);
    const g = new THREE.BoxGeometry(Math.min(1, fw * 0.6), 0.45, Math.min(0.6, fd * 0.5)), m = std(0xd9c3a0);
    for (let i = 1; i <= cols; i++) for (let j = 1; j <= rows; j++) add(g, m, r.cx - r.w / 2 + i * fw, 0.27, r.cz - r.d / 2 + j * fd);
  } else if (r.type === "stairs") {
    const long = r.w > r.d, n = 7, m = std(0xc9c6bd);
    for (let i = 0; i < n; i++) { const h = 0.12 + i * 0.12; add(new THREE.BoxGeometry(long ? r.w / n : r.w * 0.85, h, long ? r.d * 0.85 : r.d / n), m, long ? r.cx - r.w / 2 + (i + 0.5) * r.w / n : r.cx, h / 2, long ? r.cz : r.cz - r.d / 2 + (i + 0.5) * r.d / n); }
  } else if (r.type === "lift") add(new THREE.BoxGeometry(r.w * 0.8, 0.9, r.d * 0.8), std(0x9aa6ad), r.cx, 0.45, r.cz);
  else if (r.type === "open") [[-0.2, -0.2], [0.2, 0.1], [-0.1, 0.3]].forEach(([a, b]) => add(new THREE.SphereGeometry(0.45, 8, 8), std(0x3f9a4f), r.cx + a * r.w, 0.5, r.cz + b * r.d));
}
function buildRoom(plan, r) {
  const base = new THREE.Color(TYPES[r.type].c).lerp(new THREE.Color(0xffffff), r.type === "open" ? 0.2 : 0.55);
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(r.w - 0.1, r.d - 0.1), new THREE.MeshLambertMaterial({ color: base.clone() }));
  tile.rotation.x = -Math.PI / 2; tile.position.set(r.cx, 0.05, r.cz); tile.receiveShadow = true; plan.add(tile); r.tile = tile; r.base = base;
  const h = r.type === "open" ? 0.1 : 1.1; if (r.type !== "open") roomWalls(plan, r); furnish(plan, r);
  const pick = new THREE.Mesh(new THREE.BoxGeometry(r.w - 0.1, h, r.d - 0.1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  pick.position.set(r.cx, h / 2, r.cz); pick.userData.room = r; plan.add(pick); r.mesh = pick;
  if (r.door) { const d = new THREE.Mesh(new THREE.BoxGeometry(r.door.w, 0.95, r.door.d), std(0x8a5a34)); d.position.set(r.door.x, 0.5, r.door.z); plan.add(d); }
  const l = label(r.tag || r.code || r.name, r.fac ? 0.3 : 0.45); l.position.set(r.cx, 1.9, r.cz); plan.add(l);
}
export function buildWorld(scene) {
  scene.background = new THREE.Color(0xcfe1ee); scene.fog = new THREE.Fog(0xcfe1ee, 140, 330);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7fa06a, 0.95));
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.1), ms = innerWidth < 700 ? 1024 : 2048; sun.position.set(50, 90, 40); sun.castShadow = true; sun.shadow.mapSize.set(ms, ms);
  Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 1, far: 260 }); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), std(0x6aa04f)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const flat = (x, z, w, d, c, rot = 0, y = 0.05) => { const gr = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std(c)); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; gr.add(m); gr.position.set(x, y, z); gr.rotation.y = rot; scene.add(gr); };
  FOOTPATH.forEach(f => flat(f.x, f.z, f.w, f.d, 0xcfcfcf));
  SPOTS.forEach(s => { flat(s.x, s.z, s.w, s.d, 0x7fb561, s.rot, 0.04); const l = label(s.name, 0.4, "#24502f"); l.position.set(s.x, 2.5, s.z); scene.add(l); });
  const bodies = [];
  CAMPUS.forEach(c => {
    const g = new THREE.Group(), fh = c.fh || 3, H = c.floors * fh, temple = /TEMPLE/.test(c.name), lib = /LIBRARY/.test(c.name);
    if (temple) {
      const b = shadow(new THREE.Mesh(new THREE.BoxGeometry(c.w * 0.7, 2.6, c.d * 0.7), std(0xefe9dc))); b.position.y = 1.3; const r = shadow(new THREE.Mesh(new THREE.ConeGeometry(c.w * 0.62, 2.4, 4), std(0xc8472b))); r.position.y = 3.8; r.rotation.y = Math.PI / 4; g.add(b, r); b.userData.building = c.name; bodies.push(b);
    } else {
      const b = shadow(new THREE.Mesh(new THREE.BoxGeometry(c.w, H, c.d), mats(c.w, c.d, c.floors, lib ? 0xf4f4f0 : 0x5a5f66))); b.position.y = H / 2; b.userData.building = c.name; g.add(b); bodies.push(b); roofTop(g, c.w, c.d, H);
    }
    g.position.set(c.x, 0, c.z); g.rotation.y = c.rot; scene.add(g);
    const l = label(c.name, c.small ? 0.5 : 0.7); l.position.set(c.x, c.floors * fh + 3, c.z); scene.add(l);
  });
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(), pts = [];
  for (let i = 0; i < 500 && pts.length < 60; i++) {
    const x = -85 + rnd() * 170, z = -105 + rnd() * 140;
    if (Math.abs(x - EX) < 15 && Math.abs(z) < 18) continue; if (CAMPUS.some(c => Math.hypot(c.x - x, c.z - z) < Math.hypot(c.w, c.d) / 2 + 3)) continue;
    if (FOOTPATH.some(f => Math.abs(x - f.x) < f.w / 2 + 2 && Math.abs(z - f.z) < f.d / 2)) continue; pts.push([x, z]);
  }
  const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 6), std(0x6b4a2b), pts.length), cr = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 3.4, 7), std(0x2f8f4a), pts.length), m4 = new THREE.Matrix4();
  pts.forEach(([x, z], i) => { const s = 0.8 + rnd() * 0.6; m4.makeScale(s, s, s).setPosition(x, 0.8 * s, z); tr.setMatrixAt(i, m4); m4.makeScale(s, s, s).setPosition(x, 3.1 * s, z); cr.setMatrixAt(i, m4); });
  tr.castShadow = cr.castShadow = true; scene.add(tr, cr);
  /* E block: one solid floor per level; the selected floor opens as an interior plan */
  const E = new THREE.Group(); E.position.x = EX; scene.add(E);
  const floors = buildFloors(), fg = {}, shellGeo = new THREE.BoxGeometry(EW, FH, ED), edgeGeo = new THREE.EdgesGeometry(shellGeo);
  floors.forEach(F => {
    const g = new THREE.Group(); g.position.y = F.n * FH; E.add(g);
    const shell = shadow(new THREE.Mesh(shellGeo, mats(EW, ED, 1, F.n === 9 ? 0x5a5f66 : 0xcfc9bb))); shell.position.y = FH / 2; shell.userData.floor = F.n; g.add(shell);
    const em = new THREE.LineBasicMaterial({ color: 0xd9b27c, transparent: true, opacity: 0 }), edges = new THREE.LineSegments(edgeGeo, em); edges.position.y = FH / 2; g.add(edges);
    const roofParts = [];
    if (F.n === 9) { const roofStart = g.children.length; roofTop(g, EW, ED, FH); roofParts.push(...g.children.slice(roofStart)); }
    const plan = new THREE.Group(); plan.visible = false; g.add(plan);
    // Construct room meshes only when a visitor opens this level; this keeps first load fast on phones.
    const buildPlan = () => {
      if (g.userData.planBuilt) return;
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(EW, ED), std(0xe9e5db)); slab.rotation.x = -Math.PI / 2; slab.position.y = 0.02; slab.receiveShadow = true; plan.add(slab);
      const a = EW / 2, b = ED / 2; [[-a, -b, a, -b], [a, -b, a, b], [a, b, -a, b], [-a, b, -a, -b]].forEach(([x1, z1, x2, z2]) => seg(plan, x1, z1, x2, z2, 1.5, 0.22));
      LOBBIES.forEach(l => { const t = label("LOBBY", 0.35, "#7a5a2e"); t.position.set(l.x, 0.4, l.z); plan.add(t); });
      F.rooms.forEach(r => buildRoom(plan, r));
      g.userData.planBuilt = true;
    };
    fg[F.n] = { shell, em, plan, F, roofParts, buildPlan };
  });
  const el = label("BLOCK EA", 1); el.position.set(EX, 36, 0); scene.add(el);
  return { E, fg, floors, rooms: floors.flatMap(F => F.rooms), bodies, ensurePlan(n) { const o = fg[n]; if (o && !o.planBuilt) o.buildPlan(); } };
}
