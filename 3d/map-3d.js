import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { buildWorld } from '/3d/scene.js?v=20261012b';
import { routes, drawRoute, ENTRANCE } from '/3d/nav.js';
import { buildClassroomInterior, hasInteriorView } from '/3d/room-interior.js';

const stage = document.getElementById('disha3dStage');
if (!stage) throw new Error('3D campus viewport not found.');
let interiorGroup = null;
let interiorActive = false;
let savedCampusVisible = true;
const V = (x,y,z)=>new THREE.Vector3(x,y,z);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth<700?1.25:1.65));
renderer.shadowMap.enabled=innerWidth>=700;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-label','Interactive 3D campus map. Drag to rotate, pinch to zoom, and tap to select rooms or photo markers.');
stage.appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(50,1,.5,700);
const HOME={pos:V(62,62,52),target:V(0,0,-32)};
camera.position.copy(HOME.pos);
const controls=new OrbitControls(camera,renderer.domElement);
Object.assign(controls,{enableDamping:true,dampingFactor:.07,minDistance:8,maxDistance:190,maxPolarAngle:Math.PI*.49});
controls.target.copy(HOME.target);
const {E,fg,floors,rooms,bodies,ensurePlan}=buildWorld(scene);
rooms.forEach((r,i)=>{r.id=`${r.floor}-${floors.find(f=>f.n===r.floor).rooms.indexOf(r)}`;});
// Keep the model aligned with the destination labels used by the website.
for(const floor of floors){
  if(floor.n===2||floor.n===8){
    const lab=floor.rooms.find(r=>r.type==='lab'&&r.name.toLowerCase().includes('computer lab'));
    if(lab){lab.name=`Computer Lab · ${floor.n===2?'2nd':'8th'} Floor`;lab.tag='COMPUTER LAB';lab.key=`${lab.code} ${lab.name} lab computer ${floor.title} floor ${floor.n}`.toLowerCase();}
  }
  if(floor.n===7)floor.rooms.forEach(r=>{if(r.type==='lab')r.name='Chemistry Lab';});
}
const CYAN=new THREE.Color(0x00d9ff), GREY=new THREE.Color(0xcfcfcf);
function attachRoomGlow(r){
  const glow=new THREE.Group();
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.25,r.w-.16),Math.max(.25,r.d-.16)),new THREE.MeshBasicMaterial({color:CYAN,transparent:true,opacity:.38,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
  fill.rotation.x=-Math.PI/2;fill.position.set(r.cx,.095,r.cz);fill.renderOrder=20;
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(r.w-.08,.08,r.d-.08)),new THREE.LineBasicMaterial({color:CYAN,transparent:true,opacity:.98,depthTest:false}));
  edge.position.set(r.cx,.12,r.cz);edge.renderOrder=21;glow.add(fill,edge);glow.visible=false;r.tile.parent.add(glow);r.glow=glow;r.glowFill=fill;
}
function prepareFloor(n){ensurePlan(n);const F=floors.find(f=>f.n===Number(n));F?.rooms.forEach(r=>{if(r.tile&&!r.glow)attachRoomGlow(r);});}
const photoMarkers=[];
function addPhotoMarker(floorNo,code,photoId,path){
  const floor=floors.find(f=>f.n===floorNo),room=floor?.rooms.find(r=>r.code===code);if(!room)return;
  const plan=fg[floorNo].plan;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,1.25,8),new THREE.MeshBasicMaterial({color:CYAN,depthTest:false}));pole.position.set(room.cx,1.92,room.cz);pole.renderOrder=47;plan.add(pole);
  const frame=new THREE.Sprite(new THREE.SpriteMaterial({color:0x062051,depthTest:false,depthWrite:false}));frame.scale.set(3.68,2.82,1);frame.position.set(room.cx,3.13,room.cz);frame.renderOrder=48;plan.add(frame);
  const texUrl=path.startsWith('http')||path.startsWith('/')?path:new URL(path,import.meta.url).href;const texture=new THREE.TextureLoader().load(texUrl,t=>{t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;},undefined,()=>console.warn('Photo marker failed',path));
  const image=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false}));image.scale.set(3.48,2.62,1);image.position.set(room.cx,3.13,room.cz);image.renderOrder=49;image.userData.photoMarker=photoId;image.userData.floor=floorNo;plan.add(image);photoMarkers.push(image);
}
try{addPhotoMarker(8,'814','ieee-814','/static/assets/ieee-student-branch.jpg');addPhotoMarker(9,'914','aircraft-914','/static/assets/aeronautics-aircraft-room.jpg');}catch(e){console.warn('Photo markers skipped',e);}
const LERP=reduced?1:.075;
let selectedFloor=-1, category=null, blinkSet=null, focusSet=new Set(), dim=.5, goal=null, routeObj=null, lastRoutes=null, activeRouteFloors=null, routeStart=null, routeEnd=null;
const fit=()=>{const w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
new ResizeObserver(fit).observe(stage);fit();
function setShellOpacity(shell,opacity){const mats=Array.isArray(shell.material)?shell.material:[shell.material];mats.forEach(m=>{m.transparent=opacity<.999;m.opacity=opacity;m.depthWrite=opacity>=.999;m.needsUpdate=true;});shell.castShadow=shell.receiveShadow=opacity>=.999;}
function updateLayers(){const openFloors=activeRouteFloors||new Set(selectedFloor>=0?[selectedFloor]:[]);const list=activeRouteFloors?[...activeRouteFloors]:[];const lowest=list.length?Math.min(...list):selectedFloor;Object.entries(fg).forEach(([key,o])=>{const n=+key,open=openFloors.has(n);o.plan.visible=open;o.shell.visible=!open;const opacity=selectedFloor<0||n<=lowest?1:.14;setShellOpacity(o.shell,open?1:opacity);o.em.opacity=selectedFloor>=0&&n>lowest&&!open ? .32 : 0;if(o.roofParts)o.roofParts.forEach(part=>part.visible=!(open||(selectedFloor>=0&&n>selectedFloor)));});rooms.forEach(r=>{if(r.glow)r.glow.visible=focusSet.has(r)&&fg[r.floor].plan.visible;});}
function flyTo(target,offset){goal={pos:target.clone().add(offset),target};}
function selectFloor(n,fly=true){if(interiorActive)exitRoomView();n=Number(n);if(n<0){resetView();return;}prepareFloor(n);selectedFloor=n;updateLayers();if(fly)flyTo(V(-3,n*3+.5,0),V(0,28,24));dispatch('floor',{floor:n});}
function resetCamera(){if(selectedFloor>=0)flyTo(V(-3,selectedFloor*3+.5,0),V(0,28,24));else goal={pos:HOME.pos.clone(),target:HOME.target.clone()};}
function setFocus(values){focusSet=new Set((values||[]).filter(r=>r&&r!==ENTRANCE));rooms.forEach(r=>{if(r.glow)r.glow.visible=focusSet.has(r)&&fg[r.floor].plan.visible;});}
function resetView(){if(routeObj){routeObj.dispose();routeObj=null;}lastRoutes=null;activeRouteFloors=null;selectedFloor=-1;category=null;blinkSet=null;setFocus([]);dim=.5;updateLayers();goal={pos:HOME.pos.clone(),target:HOME.target.clone()};dispatch('reset',{});}
function roomByKey(q){if(!q)return null;const raw=typeof q==='object'?(q.code||q.name||''):String(q);const s=raw.trim();if(!s)return null;if(/^(main )?entrance$/i.test(s))return ENTRANCE;const code=s.replace(/^EA[- ]?/i,'').trim().toUpperCase();return rooms.find(r=>r.id===s||r.code===s.toUpperCase()||r.code===code)||rooms.find(r=>r.name.toLowerCase()===s.toLowerCase())||rooms.find(r=>r.name.toLowerCase().includes(s.toLowerCase()))||null;}
function resolve(q){if(q===ENTRANCE)return ENTRANCE;if(typeof q==='object'&&q){if(q.id==='main-entrance')return ENTRANCE;const m=String(q.id||'').match(/^f(\d+)-(\d+)$/);if(m){const direct=rooms.find(r=>r.id===`${m[1]}-${m[2]}`);if(direct)return direct;}return roomByKey(q.code||q.name);}return roomByKey(q);}
function focusRoom(value){if(interiorActive)exitRoomView();const r=resolve(value);if(!r)return false;if(r===ENTRANCE){resetView();return true;}selectFloor(r.floor,false);const routeActive=!!routeObj&&!!activeRouteFloors;const focused=routeActive?[routeStart,routeEnd,r].filter(x=>x&&x!==ENTRANCE&&x.tile):[r];setFocus(focused);blinkSet=new Set(focused);dim=0;flyTo(V(-3+r.cx,r.floor*3+.5,r.cz),V(0,11,9));dispatch('room',{id:r.id,room:r});return true;}
function highlightCategory(id,floor){category=id||null;if(floor!=null&&Number(floor)!==selectedFloor)selectFloor(Number(floor));const found=category?rooms.filter(r=>r.category===category):[];blinkSet=category&&selectedFloor>=0?new Set(found.filter(r=>r.floor===selectedFloor)):null;dim=.5;dispatch('category',{category});}
function calculateRoute(from,to){const a=resolve(from)||ENTRANCE,b=resolve(to);if(!b||b===ENTRANCE)return null;routeStart=a;routeEnd=b;lastRoutes=routes(a,b);return lastRoutes;}
function showRoute(kind){if(!lastRoutes)return false;const r=lastRoutes[kind]||lastRoutes.lift||lastRoutes.stairs||lastRoutes.walk;if(!r?.legs?.length)return false;if(routeObj)routeObj.dispose();routeObj=drawRoute(THREE,E,r,3);activeRouteFloors=new Set(r.legs.map(leg=>leg.floor));activeRouteFloors.forEach(prepareFloor);selectedFloor=r.legs[0].floor;updateLayers();const focused=[routeStart,routeEnd].filter(v=>v&&v!==ENTRANCE&&v.tile);setFocus(focused);blinkSet=new Set(focused);dim=0;const list=[...activeRouteFloors],lo=Math.min(...list),hi=Math.max(...list);if(lo!==hi){const span=(hi-lo)*3;flyTo(V(-3,(lo+hi)/2*3+.5,0),V(0,Math.max(30,span*1.3+16),Math.max(26,span*.8+16)));}else flyTo(V(-3,lo*3+.5,0),V(0,28,24));dispatch('route',{via:r.via,meters:r.meters,floors:list,route:r});return true;}
function clearRoute(){if(routeObj)routeObj.dispose();routeObj=null;lastRoutes=null;activeRouteFloors=null;routeStart=null;routeEnd=null;setFocus([]);updateLayers();blinkSet=category&&selectedFloor>=0?new Set(rooms.filter(r=>r.floor===selectedFloor&&r.category===category)):null;dim=.5;dispatch('route-clear',{});}
function dispatch(type,detail){window.dispatchEvent(new CustomEvent('soumap',{detail:{type,...detail}}));}
// Interactive picking: exposed room plans, shells and contextual campus buildings.
const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();let down=null;const touchPoints=new Map();
renderer.domElement.addEventListener('pointerdown',e=>{goal=null;if(e.pointerType==='touch'){touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size===1)down={x:e.clientX,y:e.clientY,id:e.pointerId};else down=null;}else down={x:e.clientX,y:e.clientY,id:e.pointerId};});
function finishPointer(e){const pressed=down,canPick=!!pressed&&pressed.id===e.pointerId&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)<=6&&touchPoints.size<=1;down=null;if(e.pointerType==='touch')touchPoints.delete(e.pointerId);if(!canPick)return;const rect=renderer.domElement.getBoundingClientRect();ptr.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);ray.setFromCamera(ptr,camera);const targets=[];Object.values(fg).forEach(o=>{if(o.plan.visible)o.F.rooms.forEach(r=>targets.push(r.mesh));if(o.shell.visible)targets.push(o.shell);});photoMarkers.forEach(m=>{if(fg[m.userData.floor]?.plan.visible)targets.push(m);});bodies.forEach(b=>targets.push(b));const hits=ray.intersectObjects(targets,false);const hit=hits.find(h=>h.object.userData.photoMarker)||hits.find(h=>h.object.userData.room)||hits.find(h=>h.object.userData.floor!==undefined)||hits.find(h=>h.object.userData.building);if(!hit)return;const u=hit.object.userData;if(u.photoMarker){dispatch('photo',{photoId:u.photoMarker});return;}if(u.room)focusRoom(u.room);else if(u.floor!==undefined)selectFloor(u.floor);else if(u.building){const pos=new THREE.Vector3();hit.object.getWorldPosition(pos);flyTo(pos,V(30,22,30));dispatch('building',{name:u.building});}}
renderer.domElement.addEventListener('pointerup',finishPointer);renderer.domElement.addEventListener('pointercancel',e=>{touchPoints.delete(e.pointerId);if(down?.id===e.pointerId)down=null;});

function loop(ms){requestAnimationFrame(loop);if(!stage.clientWidth||!stage.clientHeight)return;const t=ms/1000;if(goal){camera.position.lerp(goal.pos,LERP);controls.target.lerp(goal.target,LERP);if(camera.position.distanceTo(goal.pos)<.05)goal=null;}controls.update();Object.entries(fg).forEach(([key,o])=>{const opacity=selectedFloor>=0&&+key>(activeRouteFloors?Math.min(...activeRouteFloors):selectedFloor)&&!o.plan.visible ? .32 : 0;o.em.opacity+=(opacity-o.em.opacity)*.12;});const pulse=(Math.sin(t*7)+1)/2;floors.forEach(f=>{if(!fg[f.n].plan.visible)return;f.rooms.forEach(r=>{const color=r.tile.material.color;if(focusSet.has(r))color.copy(r.base).lerp(CYAN,.5+.42*pulse);else if(blinkSet&&blinkSet.has(r))color.copy(r.base).lerp(CYAN,.35+.55*pulse);else if(blinkSet&&dim)color.copy(r.base).lerp(GREY,dim);else color.copy(r.base);if(r.glowFill)r.glowFill.material.opacity=focusSet.has(r)?.26+.22*pulse:.38;});});if(routeObj)routeObj.update(t);renderer.render(scene,camera);}

/* ---- Classroom interior (EA floor 5 · 511/512/513 only) ---- */

function hideCampusForInterior() {
  Object.values(fg).forEach(o => {
    if (o.plan) o.plan.visible = false;
    if (o.shell) o.shell.visible = false;
  });
  bodies.forEach(b => { b.visible = false; });
  photoMarkers.forEach(m => { m.visible = false; });
  if (routeObj && routeObj.group) routeObj.group.visible = false;
}

function restoreCampusAfterInterior() {
  updateLayers();
  bodies.forEach(b => { b.visible = true; });
  photoMarkers.forEach(m => { m.visible = true; });
  if (routeObj && routeObj.group) routeObj.group.visible = true;
}

function exitRoomView() {
  if (!interiorActive) return false;
  if (interiorGroup) {
    scene.remove(interiorGroup);
    interiorGroup.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
        else obj.material.dispose?.();
      }
    });
    interiorGroup = null;
  }
  interiorActive = false;
  restoreCampusAfterInterior();
  try {
    if (selectedFloor >= 0) {
      prepareFloor(selectedFloor);
      updateLayers();
      flyTo(V(-3, selectedFloor * 3 + .5, 0), V(0, 28, 24));
    } else {
      resetView();
    }
  } catch (e) { console.warn(e); }
  dispatch('interior', { open: false });
  return true;
}

function enterRoomView(value) {
  const r = resolve(value);
  if (!r || !hasInteriorView(r)) return false;
  exitRoomView();
  const code = String(r.code || "").replace(/^EA-?/i, "");
  interiorGroup = buildClassroomInterior(code);
  // Place interior near origin for a dedicated camera framing
  interiorGroup.position.set(0, 0, 0);
  scene.add(interiorGroup);
  interiorActive = true;
  hideCampusForInterior();
  // Camera inside classroom looking toward the board
  controls.target.set(0, 1.2, -2);
  camera.position.set(0, 2.4, 6.5);
  controls.update();
  goal = null;
  dispatch('interior', { open: true, code, room: r });
  return true;
}

function isInteriorActive() { return interiorActive; }


window.Disha3D={
  floors:()=>floors.map(f=>({n:f.n,title:f.title,short:f.short})),
  currentFloor:()=>selectedFloor,
  selectFloor,resetView,recenter:resetCamera,
  focusRoom,
  highlightCategory,
  resolve,
  route:calculateRoute,
  showRoute,
  clearRoute,
  enterRoomView,
  exitRoomView,
  isInteriorActive,
  hasInteriorView:(v)=>hasInteriorView(resolve(v)||v),
  zoom:factor=>{const dir=camera.position.clone().sub(controls.target);dir.multiplyScalar(factor);camera.position.copy(controls.target.clone().add(dir));controls.update();},
  dispose:()=>{if(routeObj)routeObj.dispose();controls.dispose();renderer.dispose();}
};
fit();controls.update();renderer.render(scene,camera);requestAnimationFrame(loop);
