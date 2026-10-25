/**
 * Bridge between SILI agent actions and the DISHA 3D map (window.Disha3D).
 */
"use strict";

const DishaMapBridge = (() => {
  let placesById = {};
  let placesLoaded = false;

  async function loadPlaces() {
    try {
      const res = await fetch("/api/places");
      const data = await res.json();
      placesById = {};
      (data.places || []).forEach((p) => {
        if (p.id) placesById[p.id] = p;
      });
      placesLoaded = true;
    } catch (_) {
      placesLoaded = false;
    }
  }

  function waitFor3D(timeoutMs = 12000) {
    return new Promise((resolve) => {
      if (window.Disha3D) return resolve(window.Disha3D);
      // Try to kick off load if DISHA helper exists
      if (typeof window.ensure3D === "function") {
        try { window.ensure3D(); } catch (_) {}
      }
      const start = Date.now();
      const t = setInterval(() => {
        if (window.Disha3D) {
          clearInterval(t);
          resolve(window.Disha3D);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(t);
          resolve(null);
        }
      }, 150);
    });
  }

  function placeToRoom(place) {
    if (!place) return null;
    return {
      id: place.id,
      name: place.name,
      code: place.code || "",
      floor: place.floor,
      floorTitle: place.floorTitle,
      cx: place.x ?? 0,
      cz: place.y ?? 0,
      w: place.w ?? 1,
      d: place.h ?? 1,
      type: place.type,
      category: place.category,
      door: null,
    };
  }

  /** Resolve a place against live 3D graph (name / code). */
  function resolveLive(d3, place) {
    if (!place) return null;
    if (typeof d3.resolve === "function") {
      const byCode = place.code && d3.resolve(String(place.code));
      if (byCode) return byCode;
      const byName = place.name && d3.resolve(String(place.name));
      if (byName) return byName;
      // try room number only e.g. 701
      if (place.code) {
        const num = String(place.code).replace(/\D/g, "");
        if (num && d3.resolve(num)) return d3.resolve(num);
      }
    }
    return placeToRoom(place);
  }

  async function handle(action) {
    if (!action) return;
    if (!placesLoaded) await loadPlaces();

    // Navigate to map view
    try {
      if (typeof window.navigate === "function") window.navigate("map");
      else document.querySelector('[data-view="map"]')?.click();
    } catch (_) {}

    const d3 = await waitFor3D();
    if (!d3) {
      console.warn("Disha3D not ready");
      return;
    }

    if (action.type === "open_map") {
      d3.resetView?.();
      return;
    }

    if (action.type === "focus_place") {
      const place = placesById[action.place_id] || {
        id: action.place_id,
        name: action.name,
        floor: action.floor,
        code: action.code,
      };
      const room = resolveLive(d3, place);
      if (room && room.floor != null) d3.selectFloor?.(room.floor);
      d3.focusRoom?.(room);
      return;
    }

    if (action.type === "show_route") {
      const fromP = placesById[action.from_id] || { id: "main-entrance", name: "Main Entrance", floor: 0 };
      const toP = placesById[action.to_id] || {
        id: action.to_id,
        name: action.to_name,
        floor: action.floor,
        code: action.code,
      };
      const toRoom = resolveLive(d3, toP);
      const fromRoom =
        resolveLive(d3, fromP) ||
        (d3.resolve && d3.resolve("Main Entrance")) ||
        { name: "Main Entrance", floor: 0, cx: -7.8, cz: 0 };

      if (toRoom && toRoom.floor != null) d3.selectFloor?.(toRoom.floor);

      if (typeof d3.route === "function" && typeof d3.showRoute === "function" && toRoom) {
        try {
          const result = d3.route(fromRoom, toRoom);
          if (result) d3.showRoute(result);
          else d3.focusRoom?.(toRoom);
        } catch (e) {
          console.warn("route failed", e);
          d3.focusRoom?.(toRoom);
        }
      } else if (toRoom) {
        d3.focusRoom?.(toRoom);
      }
    }
  }

  async function consumePending() {
    try {
      const raw = localStorage.getItem("sili_pending_action");
      if (!raw) return;
      localStorage.removeItem("sili_pending_action");
      const action = JSON.parse(raw);
      await handle(action);
    } catch (_) {}
  }

  async function init() {
    await loadPlaces();
    setTimeout(consumePending, 1500);
  }

  return { handle, init, loadPlaces };
})();

window.DishaMapBridge = DishaMapBridge;
document.addEventListener("DOMContentLoaded", () => DishaMapBridge.init());
