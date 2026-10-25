/* SILI agent frontend — chat + map action bridge */
"use strict";

const SiliAgent = (() => {
  const API = "/api/chat";
  let isSending = false;

  const els = {
    messages: null,
    input: null,
    send: null,
    toast: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showToast(msg) {
    const t = els.toast || $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3200);
  }

  function appendMessage(role, text) {
    const box = els.messages || $("messages");
    if (!box) return;
    const welcome = $("welcome");
    if (welcome) welcome.classList.add("hidden");

    const article = document.createElement("article");
    article.className = `message ${role === "user" ? "user" : "assistant"}`;
    article.innerHTML = `
      <div class="message-avatar" aria-hidden="true">${role === "user" ? "Y" : "S"}</div>
      <div class="message-content">
        <div class="message-name">${role === "user" ? "You" : "SILI"}</div>
        <div class="message-bubble"></div>
      </div>`;
    article.querySelector(".message-bubble").textContent = text;
    box.appendChild(article);
    article.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function appendActionHint(action) {
    if (!action) return;
    const box = els.messages || $("messages");
    if (!box) return;
    const hint = document.createElement("div");
    hint.className = "action-hint";
    let label = "Map action";
    if (action.type === "focus_place") {
      label = `Highlighting: ${action.name || action.place_id}` +
        (action.floor != null ? ` (floor ${action.floor})` : "");
    } else if (action.type === "show_route") {
      label = `Route: ${action.from_name || action.from_id} → ${action.to_name || action.to_id}`;
    } else if (action.type === "open_map") {
      label = "Opening 3D campus map";
    }
    hint.innerHTML = `<button type="button" class="action-btn" data-action='${JSON.stringify(action).replace(/'/g, "&#39;")}'>⌖ ${label}</button>`;
    box.appendChild(hint);
    hint.querySelector("button")?.addEventListener("click", () => executeAction(action));
  }

  /** Execute map action — works on map page via Disha3D, or stores for map.html */
  function executeAction(action) {
    if (!action || !action.type) return;

    // Persist for map page if 3D not loaded here
    try {
      localStorage.setItem("sili_pending_action", JSON.stringify(action));
    } catch (_) {}

    // Same-page map bridge
    if (window.DishaMapBridge && typeof window.DishaMapBridge.handle === "function") {
      window.DishaMapBridge.handle(action);
      showToast("Map updated");
      return;
    }

    // Navigate to map tab / page
    const mapLink = document.querySelector('[data-view="map"]');
    if (mapLink) {
      mapLink.click();
      setTimeout(() => {
        if (window.DishaMapBridge) window.DishaMapBridge.handle(action);
      }, 600);
    } else {
      window.location.href = "/map?action=1";
    }
  }

  async function sendMessage(text) {
    const message = (text || els.input?.value || "").trim();
    if (!message || isSending) return;
    isSending = true;
    if (els.input) els.input.value = "";
    appendMessage("user", message);

    const typing = document.createElement("div");
    typing.className = "typing";
    typing.id = "typing";
    typing.textContent = "SILI soch rahi hai…";
    (els.messages || $("messages"))?.appendChild(typing);

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();
      if (!res.ok) {
        appendMessage("assistant", data.detail || "Service temporarily unavailable.");
        return;
      }
      appendMessage("assistant", data.reply || "");
      if (data.action) {
        appendActionHint(data.action);
        // Auto-run map action
        executeAction(data.action);
      }
    } catch (err) {
      typing.remove();
      appendMessage("assistant", "Network error. Backend running hai kya?");
    } finally {
      isSending = false;
    }
  }

  function init() {
    els.messages = $("messages");
    els.input = $("messageInput");
    els.send = $("sendButton");
    els.toast = $("toast");

    els.send?.addEventListener("click", () => sendMessage());
    els.input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    document.querySelectorAll("[data-prompt]").forEach((btn) => {
      btn.addEventListener("click", () => sendMessage(btn.dataset.prompt));
    });

    $("newChat")?.addEventListener("click", () => {
      if (els.messages) els.messages.innerHTML = "";
      $("welcome")?.classList.remove("hidden");
    });
  }

  return { init, sendMessage, executeAction };
})();

document.addEventListener("DOMContentLoaded", () => SiliAgent.init());
