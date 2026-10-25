/**
 * Classroom interior view for EA-wing floor 5 rooms 511, 512, 513 only.
 * Layout follows the team sketch: curved desk rows facing a front board,
 * three ACs, two exits, projector above the middle of the first student row.
 */
import * as THREE from "three";

/** Only these codes get an interior classroom model (EA wing, floor 5). */
export const INTERIOR_ROOM_CODES = new Set(["511", "512", "513"]);

export function hasInteriorView(room) {
  if (!room) return false;
  const code = String(room.code || "").replace(/^EA-?/i, "");
  return Number(room.floor) === 5 && INTERIOR_ROOM_CODES.has(code);
}

/**
 * Build a simple interior classroom group (local coordinates).
 * Front of room = -Z (board), students face -Z, entrance side near +Z.
 */
export function buildClassroomInterior(roomCode = "511") {
  const root = new THREE.Group();
  root.name = `interior-${roomCode}`;
  root.userData.interior = true;
  root.userData.roomCode = roomCode;

  // Floor
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xd4cfc4 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 16), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  root.add(floor);

  // Walls
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf2ebe0 });
  const wallH = 3.2;
  // Back wall (board wall, -Z)
  const back = new THREE.Mesh(new THREE.BoxGeometry(14, wallH, 0.12), wallMat);
  back.position.set(0, wallH / 2, -8);
  root.add(back);
  // Front wall (+Z) with doorway gap simulated as two panels
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(5, wallH, 0.12), wallMat);
  frontL.position.set(-4.5, wallH / 2, 8);
  root.add(frontL);
  const frontR = new THREE.Mesh(new THREE.BoxGeometry(5, wallH, 0.12), wallMat);
  frontR.position.set(4.5, wallH / 2, 8);
  root.add(frontR);
  // Left / right walls
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, wallH, 16), wallMat);
  left.position.set(-7, wallH / 2, 0);
  root.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.12, wallH, 16), wallMat);
  right.position.set(7, wallH / 2, 0);
  root.add(right);

  // Ceiling
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 16),
    new THREE.MeshLambertMaterial({ color: 0xe8e4dc, side: THREE.DoubleSide })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = wallH;
  root.add(ceil);

  // Blackboard / teaching board at front
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(6.5, 1.4, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x1a3d2e })
  );
  board.position.set(0, 1.8, -7.85);
  root.add(board);
  // Board frame
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 1.6, 0.05),
    new THREE.MeshLambertMaterial({ color: 0x4a3f35 })
  );
  frame.position.set(0, 1.8, -7.9);
  root.add(frame);

  // Teacher desk at front center
  const deskMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
  const tdesk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 1.0), deskMat);
  tdesk.position.set(0, 0.4, -6.2);
  root.add(tdesk);

  // Curved student desk rows (3 columns x 6 rows) — sketch style
  const deskColor = new THREE.MeshLambertMaterial({ color: 0xc4a574 });
  const seatColor = new THREE.MeshLambertMaterial({ color: 0x5c6b7a });
  const rows = 6;
  const cols = 3;
  const rowSpacing = 1.55;
  const startZ = -3.2; // first student row (closest to board)

  for (let row = 0; row < rows; row++) {
    const z = startZ + row * rowSpacing;
    // slight curve: side columns farther back
    for (let col = 0; col < cols; col++) {
      const xBase = (col - 1) * 3.6;
      const curve = Math.abs(col - 1) * 0.22 * (row * 0.15 + 1);
      const zDesk = z + curve;
      // long curved desk as a box with slight rotation
      const desk = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.55), deskColor);
      desk.position.set(xBase, 0.72, zDesk);
      const angle = (col - 1) * 0.08;
      desk.rotation.y = angle;
      root.add(desk);
      // desk legs
      for (const lx of [-1.2, 1.2]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.7, 0.06),
          new THREE.MeshLambertMaterial({ color: 0x555555 })
        );
        leg.position.set(xBase + lx, 0.35, zDesk);
        root.add(leg);
      }
      // three seats per desk
      for (let s = 0; s < 3; s++) {
        const sx = xBase + (s - 1) * 0.85;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.4), seatColor);
        seat.position.set(sx, 0.45, zDesk + 0.45);
        root.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.06), seatColor);
        back.position.set(sx, 0.65, zDesk + 0.62);
        root.add(back);
      }
    }
  }

  // Projector above middle of first student row
  const projBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.2, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x222222 })
  );
  projBody.position.set(0, 2.85, startZ);
  root.add(projBody);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.12, 12),
    new THREE.MeshLambertMaterial({ color: 0x111111 })
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 2.85, startZ - 0.28);
  root.add(lens);
  // subtle light cone toward board
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 3.2, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffffee,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  cone.position.set(0, 2.2, startZ - 1.6);
  cone.rotation.x = Math.PI / 2.4;
  root.add(cone);

  // 3 air conditioners — wall-mounted style along side / rear
  const acMat = new THREE.MeshLambertMaterial({ color: 0xe8eef2 });
  const acPositions = [
    [-6.6, 2.6, -4],
    [-6.6, 2.6, 1],
    [6.6, 2.6, -1.5],
  ];
  acPositions.forEach(([x, y, z], i) => {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 1.1), acMat);
    ac.position.set(x, y, z);
    root.add(ac);
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.2, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x90a4ae })
    );
    vent.position.set(x + (x < 0 ? 0.12 : -0.12), y, z);
    root.add(vent);
  });

  // Two exits — door frames
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x6d4c2e });
  // Exit 1: rear-left near board wall side corridor feel
  const door1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.08), doorMat);
  door1.position.set(-5.2, 1.1, -7.88);
  root.add(door1);
  // Exit 2: front entrance (main)
  const door2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.08), doorMat);
  door2.position.set(0, 1.1, 7.92);
  root.add(door2);
  // Exit signs (simple red panels)
  const exitMat = new THREE.MeshBasicMaterial({ color: 0xc62828 });
  const ex1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.04), exitMat);
  ex1.position.set(-5.2, 2.4, -7.82);
  root.add(ex1);
  const ex2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.04), exitMat);
  ex2.position.set(0, 2.4, 7.86);
  root.add(ex2);

  // Room label plate
  const label = makeTextSprite(`Classroom ${roomCode} · EA Wing · Floor 5`);
  label.position.set(0, 3.0, -7.5);
  root.add(label);

  // Ambient fill light parented to room
  const light = new THREE.PointLight(0xfff5e6, 0.85, 28);
  light.position.set(0, 2.8, 0);
  root.add(light);
  const light2 = new THREE.PointLight(0xe3f2fd, 0.35, 20);
  light2.position.set(0, 2.5, -5);
  root.add(light2);

  return root;
}

function makeTextSprite(text) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(6,32,81,0.85)";
  g.fillRect(0, 0, 1024, 128);
  g.fillStyle = "#ffffff";
  g.font = "bold 48px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 512, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(5.5, 0.7, 1);
  return spr;
}
