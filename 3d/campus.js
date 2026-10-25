/* SOU campus layout - traced from the team's hand-drawn campus sketch (paper: top=south, left=east).
   Positions are APPROXIMATE (sketch not to scale). Non-target block details are contextual only. */
const k = 0.05, R = 0.4, X = u => -3 + (860 - u) * k, Z = v => (270 - v) * k;
const blk = (name, u, v, wu, hv, floors, rot = 0, extra = {}) => ({ name, x: X(u), z: Z(v), w: wu * k, d: hv * k, floors, rot, ...extra });
const spot = (name, u, v, wu, hv, rot = 0) => ({ name, x: X(u), z: Z(v), w: wu * k, d: hv * k, rot });
export const CAMPUS = [
  blk("BLOCK EB", 1205, 362, 300, 225, 10, 0, { small: true }),
  blk("BLOCK B", 730, 1260, 400, 380, 8, R),
  blk("BLOCK D", 1240, 830, 560, 280, 7, R),
  blk("BLOCK A", 1230, 1330, 270, 300, 6, R),
  blk("BLOCK B WING", 1230, 1130, 410, 100, 6, R, { small: true }),
  blk("BASEMENT LIBRARY", 922, 1802, 1495, 295, 1),
  blk("HANUMANJI TEMPLE", 557, 282, 165, 215, 1, 0, { fh: 4, small: true })
];
export const SPOTS = [spot("SEATING + DEMO JET", 690, 860, 280, 330, R), spot("STEP SEATING", 1130, 640, 400, 80, R), spot("CANTEEN FOOD COURT", 850, 1780, 1265, 140)];
export const FOOTPATH = [spot("", 375, 780, 160, 1450)];
