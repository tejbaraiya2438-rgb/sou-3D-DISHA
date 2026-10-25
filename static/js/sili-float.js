/**
 * SILI floating chatbot — formal tone, EN/HI language, voice on/off.
 */
"use strict";

const SiliFloat = (() => {
  const API = "/api/chat";
  const STORE_VOICE = "sili_voice_on";
  const STORE_LANG = "sili_language";

  let open = false;
  let sending = false;
  let voiceOn = false;
  let language = "en";

  try {
    const v = localStorage.getItem(STORE_VOICE);
    if (v === "0") voiceOn = false;
    if (v === "1") voiceOn = true;
    const l = localStorage.getItem(STORE_LANG);
    if (l === "hi" || l === "en") language = l;
  } catch (e) {}

  const copy = {
    en: {
      title: "SILI",
      subtitle: "Silver Oak Intelligence",
      welcome:
        "Welcome. I am SILI — Silver Oak Intelligence, the official campus assistant for Silver Oak University.\n\n" +
        "I can assist you with faculty details, room locations, events, examinations, and indoor routes.\n\n" +
        "For information only, you may ask: \"Who is the Dean?\"\n" +
        "After a faculty answer, you may use \"Take me to 3D view\" to open their room on the map.",
      placeholder: "Ask about faculty, events, or routes…",
      send: "Send",
      listen: "Listen",
      showRoute: "Show route on map",
      showMap: "Take me to 3D view",
      openMap: "Open campus map",
      thinking: "Please wait…",
      network: "Unable to reach the server. Please ensure the backend is running.",
      unavailable: "The service is temporarily unavailable.",
      chipDean: "Who is the Dean?",
      chipEvents: "Campus events",
      chipFaculty: "Faculty location",
      chipRoute: "Route to IEEE",
      voiceOn: "Voice on",
      voiceOff: "Voice off",
      langEn: "English",
      langHi: "हिन्दी",
    },
    hi: {
      title: "SILI",
      subtitle: "सिल्वर ओक इंटेलिजेंस",
      welcome:
        "स्वागत है। मैं SILI हूँ — सिल्वर ओक इंटेलिजेंस, सिल्वर ओक यूनिवर्सिटी की आधिकारिक कैंपस सहायक।\n\n" +
        "मैं संकाय विवरण, कक्ष स्थान, कार्यक्रम, परीक्षाएँ और आंतरिक मार्ग में आपकी सहायता कर सकती हूँ।\n\n" +
        "केवल जानकारी के लिए पूछें: \"डीन कौन हैं?\"\n" +
        "संकाय उत्तर के बाद \"3D दृश्य पर जाएँ\" दबाकर उनके कक्ष को मानचित्र पर देख सकते हैं।",
      placeholder: "संकाय, कार्यक्रम या मार्ग पूछें…",
      send: "भेजें",
      listen: "सुनें",
      showRoute: "मानचित्र पर मार्ग दिखाएँ",
      showMap: "3D दृश्य पर जाएँ",
      openMap: "कैंपस मानचित्र खोलें",
      thinking: "कृपया प्रतीक्षा करें…",
      network: "सर्वर से संपर्क नहीं हो सका। कृपया सुनिश्चित करें कि बैकएंड चालू है।",
      unavailable: "सेवा अस्थायी रूप से अनुपलब्ध है।",
      chipDean: "डीन कौन हैं?",
      chipEvents: "कैंपस कार्यक्रम",
      chipFaculty: "संकाय स्थान",
      chipRoute: "IEEE का रूट",
      voiceOn: "आवाज़ चालू",
      voiceOff: "आवाज़ बंद",
      langEn: "English",
      langHi: "हिन्दी",
    },
  };

  function t() {
    return copy[language] || copy.en;
  }

  function el(html) {
    var tmpl = document.createElement("template");
    tmpl.innerHTML = html.trim();
    return tmpl.content.firstElementChild;
  }

  function injectUI() {
    if (document.getElementById("sili-fab")) return;

    var style = document.createElement("style");
    style.textContent = `
#sili-fab{
  position:fixed;right:20px;bottom:20px;z-index:10050;
  width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;
  background:linear-gradient(145deg,#8b1e3f,#c43b5e);color:#fff;
  font-weight:700;font-size:16px;
  box-shadow:0 8px 28px rgba(139,30,63,.45);
  display:flex;align-items:center;justify-content:center;
}
#sili-fab:hover{transform:scale(1.05)}
#sili-fab.listening{box-shadow:0 0 0 4px rgba(61,206,122,.45)}
#sili-fab .sili-dot{
  position:absolute;top:6px;right:8px;width:10px;height:10px;
  background:#3dce7a;border:2px solid #8b1e3f;border-radius:50%;
}
#sili-panel{
  position:fixed;right:20px;bottom:90px;z-index:10050;
  width:min(400px,calc(100vw - 24px));height:min(560px,74vh);
  background:#fff;border-radius:18px;overflow:hidden;
  box-shadow:0 16px 48px rgba(0,0,0,.22);
  display:none;flex-direction:column;
  font-family:DM Sans,Manrope,system-ui,sans-serif;
  border:1px solid rgba(6,32,81,.08);
}
#sili-panel.open{display:flex}
#sili-panel header{
  background:linear-gradient(135deg,#6b1530,#8b1e3f);color:#fff;
  padding:12px 14px;display:flex;align-items:center;gap:10px;
}
#sili-panel header .avatar{
  width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);
  display:grid;place-items:center;font-weight:700;flex-shrink:0;
}
#sili-panel header h3{margin:0;font-size:15px}
#sili-panel header p{margin:0;font-size:11px;opacity:.85}
#sili-panel header .sili-close{
  margin-left:auto;background:transparent;border:none;color:#fff;
  font-size:20px;cursor:pointer;padding:4px 8px;
}
#sili-toolbar{
  display:flex;gap:8px;align-items:center;padding:8px 12px;
  background:#faf8f6;border-bottom:1px solid #eee;flex-wrap:wrap;
}
#sili-toolbar label{font-size:11px;color:#555;display:flex;align-items:center;gap:4px}
#sili-toolbar select,#sili-toolbar button.sili-toggle{
  font-size:12px;border:1px solid #ddd;border-radius:8px;padding:4px 8px;
  background:#fff;cursor:pointer;color:#222;
}
#sili-toolbar button.sili-toggle.on{background:#062051;color:#fff;border-color:#062051}
#sili-msgs{
  flex:1;overflow-y:auto;padding:14px;background:#f7f5f3;
  display:flex;flex-direction:column;gap:10px;
}
.sili-msg{max-width:92%;padding:10px 12px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:pre-wrap}
.sili-msg.bot{background:#fff;color:#1a1a1a;align-self:flex-start;border:1px solid #ebe6e0}
.sili-msg.user{background:#8b1e3f;color:#fff;align-self:flex-end}
.sili-msg .sili-actions{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}
.sili-msg .sili-act{
  background:#062051;color:#fff;border:none;border-radius:20px;
  padding:7px 12px;font-size:12px;cursor:pointer;font-weight:600;
}
.sili-msg .sili-tools{margin-top:6px;display:flex;gap:6px}
.sili-msg .sili-tool{
  background:transparent;border:1px solid #ddd;border-radius:12px;
  padding:3px 8px;font-size:11px;cursor:pointer;color:#555;
}
.sili-typing{font-size:12px;color:#888;font-style:italic}
#sili-input-row{
  display:flex;gap:6px;padding:12px;border-top:1px solid #eee;background:#fff;align-items:center;
}
#sili-input-row input{
  flex:1;border:1px solid #ddd;border-radius:22px;padding:10px 14px;font-size:14px;outline:none;
}
#sili-input-row input:focus{border-color:#8b1e3f}
#sili-input-row button{
  background:#8b1e3f;color:#fff;border:none;border-radius:22px;
  padding:0 14px;height:40px;font-weight:600;cursor:pointer;font-size:13px;
}
#sili-mic{
  background:#f0ebe8 !important;color:#8b1e3f !important;min-width:40px;font-size:16px !important;
}
#sili-mic.listening{background:#3dce7a !important;color:#fff !important}
.sili-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;background:#f7f5f3}
.sili-chip{
  background:#fff;border:1px solid #e0dcd6;border-radius:16px;
  padding:5px 10px;font-size:11.5px;cursor:pointer;color:#333;
}
`;
    document.head.appendChild(style);

    var fab = el('<button id="sili-fab" type="button" aria-label="Open SILI" title="SILI — Silver Oak Intelligence">S<span class="sili-dot"></span></button>');

    var panel = el(
      '<div id="sili-panel" role="dialog" aria-label="SILI">' +
        '<header>' +
        '<div class="avatar">S</div>' +
        '<div><h3 id="sili-title">SILI</h3><p id="sili-subtitle">Silver Oak Intelligence</p></div>' +
        '<button type="button" class="sili-close" id="sili-close" aria-label="Close">×</button>' +
        '</header>' +
        '<div id="sili-toolbar">' +
        '<label>Language <select id="sili-lang"><option value="en">English</option><option value="hi">हिन्दी</option></select></label>' +
        '<button type="button" class="sili-toggle" id="sili-voice-toggle">Voice on</button>' +
        '</div>' +
        '<div id="sili-msgs"></div>' +
        '<div class="sili-chips" id="sili-chips"></div>' +
        '<div id="sili-input-row">' +
        '<button type="button" id="sili-mic" title="Voice input">🎤</button>' +
        '<input id="sili-input" type="text" autocomplete="off" />' +
        '<button type="button" id="sili-send">Send</button>' +
        '</div></div>'
    );

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    fab.addEventListener("click", function () { toggle(true); });
    panel.querySelector("#sili-close").addEventListener("click", function () { toggle(false); });
    panel.querySelector("#sili-send").addEventListener("click", function () { send(); });
    panel.querySelector("#sili-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") send();
    });
    panel.querySelector("#sili-mic").addEventListener("click", function () { startMic(); });

    var langSel = panel.querySelector("#sili-lang");
    langSel.value = language;
    langSel.addEventListener("change", function () {
      language = langSel.value === "hi" ? "hi" : "en";
      try { localStorage.setItem(STORE_LANG, language); } catch (e) {}
      applyLocale();
      clearMessages();
      addBot(t().welcome);
    });

    var voiceBtn = panel.querySelector("#sili-voice-toggle");
    voiceBtn.addEventListener("click", function () {
      voiceOn = !voiceOn;
      try { localStorage.setItem(STORE_VOICE, voiceOn ? "1" : "0"); } catch (e) {}
      if (!voiceOn) stopAllSpeech();
      updateVoiceButton();
    });

    applyLocale();
    updateVoiceButton();
    addBot(t().welcome);
  }

  function applyLocale() {
    var c = t();
    var title = document.getElementById("sili-title");
    var sub = document.getElementById("sili-subtitle");
    var input = document.getElementById("sili-input");
    var sendBtn = document.getElementById("sili-send");
    if (title) title.textContent = c.title;
    if (sub) sub.textContent = c.subtitle;
    if (input) input.placeholder = c.placeholder;
    if (sendBtn) sendBtn.textContent = c.send;

    var chips = document.getElementById("sili-chips");
    if (chips) {
      chips.innerHTML = "";
      var items = [
        { q: language === "hi" ? "डीन कौन हैं?" : "Who is the Dean?", label: c.chipDean },
        { q: language === "hi" ? "कैंपस में कौन से कार्यक्रम हैं?" : "What events are on campus?", label: c.chipEvents },
        { q: language === "hi" ? "मोक्षा सातिया कहाँ हैं?" : "Where is Moksha Satiya?", label: c.chipFaculty },
        { q: language === "hi" ? "IEEE सेल का रूट" : "Route to IEEE Student Branch Cell", label: c.chipRoute },
      ];
      items.forEach(function (item) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "sili-chip";
        b.textContent = item.label;
        b.addEventListener("click", function () { send(item.q); });
        chips.appendChild(b);
      });
    }
    updateVoiceButton();
  }

  function updateVoiceButton() {
    var btn = document.getElementById("sili-voice-toggle");
    if (!btn) return;
    var c = t();
    btn.textContent = voiceOn ? c.voiceOn : c.voiceOff;
    btn.classList.toggle("on", voiceOn);
  }

  function clearMessages() {
    var box = document.getElementById("sili-msgs");
    if (box) box.innerHTML = "";
  }

  function toggle(force) {
    open = force !== undefined ? force : !open;
    var panel = document.getElementById("sili-panel");
    if (panel) panel.classList.toggle("open", open);
    if (open) {
      var input = document.getElementById("sili-input");
      if (input) input.focus();
    }
  }

  function stopAllSpeech() {
    try {
      if (window.SILIVoice && typeof window.SILIVoice.stopSpeaking === "function") {
        window.SILIVoice.stopSpeaking();
      }
    } catch (e) {}
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch (e) {}
  }

  /** Auto reply speech — only when Voice is ON */
  function speak(text) {
    if (!voiceOn) {
      stopAllSpeech();
      return;
    }
    var clean = String(text || "").trim();
    if (!clean) return;
    if (window.SILIVoice && typeof window.SILIVoice.speak === "function") {
      window.SILIVoice.speak(clean);
      return;
    }
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(clean.slice(0, 1500));
    u.lang = language === "hi" ? "hi-IN" : "en-IN";
    window.speechSynthesis.speak(u);
  }

  /** Manual Listen button — one-shot, does not turn Voice ON permanently */
  function speakOnce(text) {
    var clean = String(text || "").trim();
    if (!clean) return;
    if (window.SILIVoice && typeof window.SILIVoice.speak === "function") {
      window.SILIVoice.speak(clean);
      return;
    }
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(clean.slice(0, 1500));
    u.lang = language === "hi" ? "hi-IN" : "en-IN";
    window.speechSynthesis.speak(u);
  }

  function startMic() {
    var micBtn = document.getElementById("sili-mic");
    if (window.SILIVoice && typeof window.SILIVoice.toggleListening === "function") {
      window.SILIVoice.toggleListening(
        function (transcript) {
          var input = document.getElementById("sili-input");
          if (input) input.value = transcript;
          send(transcript);
        },
        function (err) { console.warn("mic", err); }
      );
      return;
    }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert(language === "hi" ? "इस ब्राउज़र में ध्वनि इनपुट समर्थित नहीं है।" : "Voice input is not supported in this browser.");
      return;
    }
    var rec = new SR();
    rec.lang = language === "hi" ? "hi-IN" : "en-IN";
    rec.interimResults = false;
    if (micBtn) micBtn.classList.add("listening");
    var fab = document.getElementById("sili-fab");
    if (fab) fab.classList.add("listening");
    rec.onresult = function (e) { send(e.results[0][0].transcript); };
    rec.onend = function () {
      if (micBtn) micBtn.classList.remove("listening");
      if (fab) fab.classList.remove("listening");
    };
    rec.start();
  }

  function addBot(text, action) {
    var box = document.getElementById("sili-msgs");
    if (!box) return;
    var c = t();
    var div = document.createElement("div");
    div.className = "sili-msg bot";
    div.textContent = text;

    var tools = document.createElement("div");
    tools.className = "sili-tools";
    var listen = document.createElement("button");
    listen.type = "button";
    listen.className = "sili-tool";
    listen.textContent = c.listen;
    listen.addEventListener("click", function () {
      speakOnce(text);
    });
    tools.appendChild(listen);
    div.appendChild(tools);

    if (action && (action.type === "focus_place" || action.type === "show_route" || action.type === "open_map")) {
      var row = document.createElement("div");
      row.className = "sili-actions";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sili-act";
      if (action.type === "show_route") btn.textContent = c.showRoute;
      else if (action.type === "focus_place") btn.textContent = c.showMap;
      else btn.textContent = c.openMap;
      btn.addEventListener("click", function () { runMapAction(action); });
      row.appendChild(btn);
      div.appendChild(row);
    }

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function addUser(text) {
    var box = document.getElementById("sili-msgs");
    if (!box) return;
    var div = document.createElement("div");
    div.className = "sili-msg user";
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  async function runMapAction(action) {
    try {
      localStorage.setItem("sili_pending_action", JSON.stringify(action));
    } catch (e) {}
    if (typeof window.navigate === "function") window.navigate("map");
    else {
      var link = document.querySelector('[data-view="map"]');
      if (link) link.click();
    }
    function tryApply(n) {
      if (window.DishaMapBridge && typeof window.DishaMapBridge.handle === "function") {
        window.DishaMapBridge.handle(action);
        return;
      }
      if (n > 0) setTimeout(function () { tryApply(n - 1); }, 400);
    }
    setTimeout(function () { tryApply(25); }, 400);
  }

  async function send(preset) {
    var input = document.getElementById("sili-input");
    var text = (preset || (input && input.value) || "").trim();
    if (!text || sending) return;
    sending = true;
    if (input) input.value = "";
    addUser(text);

    var box = document.getElementById("sili-msgs");
    var typing = document.createElement("div");
    typing.className = "sili-typing";
    typing.textContent = t().thinking;
    if (box) box.appendChild(typing);

    try {
      var res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language: language }),
      });
      var data = await res.json().catch(function () { return {}; });
      typing.remove();
      if (!res.ok) {
        addBot(typeof data.detail === "string" ? data.detail : t().unavailable);
        return;
      }
      var reply = data.reply || "";
      addBot(reply, data.action || null);
      if (voiceOn) {
        speak(reply);
      } else {
        stopAllSpeech();
      }
    } catch (e) {
      typing.remove();
      addBot(t().network);
    } finally {
      sending = false;
    }
  }

  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", injectUI);
    } else injectUI();
  }

  return { init: init, toggle: toggle, runMapAction: runMapAction };
})();

SiliFloat.init();
window.SiliFloat = SiliFloat;
