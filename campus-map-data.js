/* SOU 3D DISHA - College of Technology E-block floor data.
   Floor geometry and room positions follow the supplied team floor sketch.
   Public-facing staff names/timings are intentionally not fabricated. */
export const TYPES = {
  class:    { c: 0xc9a77c, l: "Classroom" },
  staff:    { c: 0xd9895a, l: "Staffroom" },
  hall:     { c: 0x8fae8b, l: "Hall" },
  lab:      { c: 0x5f9ea0, l: "Lab" },
  workshop: { c: 0xa2754e, l: "Workshop" },
  cell:     { c: 0xc4647a, l: "Cell" },
  hr:       { c: 0xb58fb3, l: "HR & Staff Offices" },
  facility: { c: 0x8a7f72, l: "Facility" },
  wash:     { c: 0x8a7f72, l: "Facility" },
  lift:     { c: 0x8a7f72, l: "Facility" },
  stairs:   { c: 0x8a7f72, l: "Facility" },
  open:     { c: 0x6b7a52, l: "Facility" }
};

/* Exactly the visitor filters requested. Internal types above remain separate
   so the renderer can style doors/lifts/stairs without exposing extra filters. */
export const FILTERS = [
  { id: "hall", label: "Halls", color: TYPES.hall.c, types: ["hall"] },
  { id: "staff", label: "Staffrooms", color: TYPES.staff.c, types: ["staff", "hr"] },
  { id: "lab", label: "Labs", color: TYPES.lab.c, types: ["lab"] },
  { id: "workshop", label: "Workshops", color: TYPES.workshop.c, types: ["workshop"] },
  { id: "cell", label: "Cells", color: TYPES.cell.c, types: ["cell"] },
  { id: "facility", label: "Facilities", color: TYPES.facility.c, types: ["facility", "wash", "lift", "stairs", "open"] }
];

const s = 18 / 1465;
export const X = u => -9 + (1550 - u) * s;
export const Z = v => -13 + (2210 - v) * s;
const W = ([u0, v0, u1, v1]) => ({
  cx: X((u0 + u1) / 2),
  cz: Z((v0 + v1) / 2),
  w: (u1 - u0) * s,
  d: (v1 - v0) * s
});

function doorOf([u0, v0, u1, v1], side) {
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  const vert = side === "l" || side === "r";
  const [u, v] = { l: [u0, vm], r: [u1, vm], t: [um, v0], b: [um, v1] }[side];
  return { x: X(u), z: Z(v), w: vert ? 0.25 : 1, d: vert ? 1 : 0.25 };
}

export const LOBBIES = [[425, 800], [850, 1000], [620, 540]].map(([u, v]) => ({ x: X(u), z: Z(v) }));

// Base geometry. The same supplied footprint is retained on every level;
// floor-specific functions below change the semantic use of mapped spaces.
const P = [
  ["staff", [85, 1950, 465, 2210], "t"],
  ["class", [85, 1600, 345, 1950], "t"], ["class", [85, 1135, 360, 1500], "r"],
  ["class", [85, 750, 360, 1135], "r"], ["class", [85, 450, 360, 750], "r"], ["class", [85, 100, 360, 450], "r"],
  ["class", [490, 100, 615, 455], "b"], ["class", [615, 100, 750, 455], "b"],
  ["class", [490, 620, 620, 890], "t"], ["class", [620, 620, 750, 890], "t"],
  ["class", [1075, 615, 1530, 880], "l"], ["class", [1075, 880, 1530, 1135], "l"],
  ["class", [1075, 1135, 1530, 1400], "l"], ["class", [1080, 1400, 1315, 1700], "l"],
  ["staff", [985, 1910, 1285, 2185], "t"],
  ["hall", [1420, 1700, 1530, 1910], "l"], ["hall", [1420, 1500, 1530, 1700], "l"],
  ["wash", [1315, 1400, 1530, 1500], "l", "Washroom"],
  ["wash", [1340, 85, 1530, 610], "", "Boys Washroom"], ["wash", [1070, 100, 1340, 455], "", "Girls Washroom"],
  ["lift", [1290, 1910, 1390, 2185]], ["stairs", [1390, 1910, 1550, 2185]],
  ["stairs", [750, 100, 915, 455]], ["stairs", [915, 100, 1075, 455]],
  ["stairs", [470, 1840, 620, 2200]], ["stairs", [620, 1840, 765, 2200]],
  ["lift", [470, 1725, 620, 1840]], ["lift", [620, 1725, 770, 1840]],
  ["lift", [490, 890, 620, 1015]], ["lift", [620, 890, 750, 1015]],
  ["lift", [490, 1015, 620, 1140]], ["lift", [620, 1015, 750, 1140]],
  ["lift", [490, 1140, 620, 1255]], ["lift", [620, 1140, 750, 1255]],
  ["open", [515, 1265, 750, 1650]]
];

const FL = {
  0: ["Ground Floor", "Ground"],
  1: ["General Classrooms", "Classrooms"],
  2: ["General Classrooms", "Classrooms"],
  3: ["General Classrooms", "Classrooms"],
  4: ["General Classrooms", "Classrooms"],
  5: ["General Classrooms", "Seminar Halls"],
  6: ["HR & Staff Offices", "HR / Staff"],
  7: ["Chemistry Lab Area", "Chemistry"],
  8: ["IEEE Student Branch Cell", "IEEE Cell"],
  9: ["Aeronautics Department", "Aeronautics"]
};

const SPECIAL = {
  5: {
    hall: ["Vikram Sarabhai Hall", "hall"],
    hall2: ["APJ Abdul Kalam Hall", "hall"]
  },
  6: { mappedKind: "hr", mappedName: "HR & Staff Offices" },
  7: { mappedKind: "lab", mappedName: "Chemistry Lab Area" },
  8: { hall: ["IEEE Student Branch Cell", "cell"], hall2: ["IEEE Student Branch Cell", "cell"] },
  9: { hall: ["Vikram Sarabhai Hall", "hall"], hall2: ["APJ Abdul Kalam Hall", "hall"] }
};

const descriptor = n => n === 9 ? "Aeronautics " : "";

export function buildFloors() {
  return Object.keys(FL).map(k => {
    const n = +k, [title, short] = FL[k];
    let roomIndex = 0, hallIndex = 0, liftIndex = 0, stairsIndex = 0;

    const rooms = P.map(([kind, box, side, hint]) => {
      const base = {
        floor: n,
        floorTitle: title,
        ...W(box),
        staff: "",
        numbered: false,
        fac: false,
        door: side ? doorOf(box, side) : null
      };

      let r = { ...base, type: kind, code: "", name: hint || kind, tag: "" };

      // Floor 6: all spaces that are mapped as hall/washroom on the shared sketch
      // are semantically HR & Staff Offices, exactly as requested.
      if (n === 6 && (kind === "hall" || kind === "wash")) {
        r.type = "hr"; r.name = "HR & Staff Offices"; r.tag = "HR"; r.fac = true;
      }
      // Floor 7: all hall/washroom placeholders become Chemistry Lab Area.
      else if (n === 7 && (kind === "hall" || kind === "wash")) {
        r.type = "lab"; r.name = "Chemistry Lab Area"; r.tag = "CHEM LAB"; r.fac = true;
      }
      // Floor 8: hall placeholders become IEEE Student Branch Cell.
      else if (n === 8 && kind === "hall") {
        r.type = "cell"; r.name = "IEEE Student Branch Cell"; r.tag = "IEEE CELL"; r.fac = true;
      }
      // Floor 5: named halls.
      else if (n === 5 && kind === "hall") {
        hallIndex++;
        const h = hallIndex === 1 ? SPECIAL[5].hall : SPECIAL[5].hall2;
        r.type = h[1]; r.name = h[0]; r.tag = r.name.toUpperCase();
      }
      // Floor 9: aeronautics halls; the rest remains department-labelled.
      else if (n === 9 && kind === "hall") {
        hallIndex++;
        const h = hallIndex === 1 ? SPECIAL[9].hall : SPECIAL[9].hall2;
        r.type = h[1]; r.name = h[0]; r.tag = r.name.toUpperCase();
      }
      else if (kind === "staff" || kind === "class") {
        roomIndex++;
        r.code = `${n ? n : "G"}${String(roomIndex).padStart(2, "0")}`;
        r.numbered = true;
        r.tag = r.code;
        r.type = kind;
        if (kind === "staff") r.name = `${descriptor(n)}Staff Room ${r.code}`;
        else r.name = `${descriptor(n)}Classroom ${r.code}`;
      }
      else if (kind === "wash") {
        r.type = "wash"; r.fac = true; r.tag = "FACILITY";
        r.name = hint || "Washroom";
      }
      else if (kind === "lift") {
        r.type = "lift"; r.fac = true; r.name = "Lift"; r.tag = "LIFT"; liftIndex++;
      }
      else if (kind === "stairs") {
        r.type = "stairs"; r.fac = true; r.name = `Stairs ${++stairsIndex}`; r.tag = "STAIRS";
      }
      else if (kind === "open") {
        r.type = "open"; r.fac = true; r.name = "Open Area"; r.tag = "FACILITY";
      }

      if (r.type === "facility" || r.type === "wash" || r.type === "lift" || r.type === "stairs" || r.type === "open" || r.type === "hr" || r.type === "lab" && (n === 6 || n === 7)) r.fac = true;
      r.category = r.type === "hall" ? "hall"
        : r.type === "staff" || r.type === "hr" ? "staff"
        : r.type === "lab" ? "lab"
        : r.type === "workshop" ? "workshop"
        : r.type === "cell" ? "cell"
        : r.type === "class" ? null
        : "facility";

      if (kind === "hall" && r.name === "hall") { hallIndex++; r.name = `Hall ${hallIndex}`; r.tag = "HALL"; }
      if (n === 0 && r.numbered) { r.name = `Room ${r.code}`; r.type = "class"; r.category = null; r.tag = r.code; }
      r.hours = "See authorized timetable / booking information";
      r.key = `${r.code} ${r.name} ${TYPES[r.type].l} ${title} floor ${n} e block college technology`.toLowerCase();
      return r;
    });

    return { n, title, short, rooms };
  });
}
