"use strict";

window.SILIVoice = (() => {
    let recognition = null;
    let listening = false;
    let currentAudio = null;
    let audioUrl = null;
    let speechSession = 0;

    function setMicState(active) {
        listening = active;
        const mic = document.getElementById("micButton");

        if (mic) {
            mic.classList.toggle("listening", active);
            mic.setAttribute("aria-label", active ? "Stop listening" : "Start voice input");
            mic.setAttribute("aria-pressed", String(active));
        }
    }

    function stopSpeaking() {
        speechSession++;

        if (currentAudio) {
            currentAudio.pause();
            currentAudio.removeAttribute("src");
            currentAudio.load();
            currentAudio = null;
        }

        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            audioUrl = null;
        }

        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
    }

    function browserSpeak(text, session) {
        if (!("speechSynthesis" in window)) {
            console.error("SILI: Browser speech synthesis unavailable.");
            return Promise.resolve(false);
        }

        const synthesis = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = synthesis.getVoices();

        const voice =
            voices.find(v => v.lang.toLowerCase() === "en-in") ||
            voices.find(v => v.lang.toLowerCase().startsWith("en-")) ||
            null;

        utterance.lang = voice?.lang || "en-IN";
        utterance.rate = 1;
        utterance.pitch = 1;

        if (voice) utterance.voice = voice;

        return new Promise(resolve => {
            let settled = false;
            let started = false;
            let timer;

            const finish = success => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(success);
            };

            utterance.onstart = () => {
                started = true;
                console.log("SILI: Browser speech started.");
            };

            utterance.onend = () => finish(true);

            utterance.onerror = event => {
                console.error("SILI browser TTS error:", event.error);
                finish(false);
            };

            if (session !== speechSession) {
                finish(false);
                return;
            }

            timer = setTimeout(() => {
                if (!started) {
                    console.error("SILI: Browser speech did not start.");
                    synthesis.cancel();
                    finish(false);
                }
            }, 8000);

            synthesis.cancel();
            synthesis.speak(utterance);
        });
    }

    async function speak(text) {
        const cleanText = String(text || "").trim();
        if (!cleanText) return;

        stopSpeaking();
        const session = speechSession;

        // Free browser voice is attempted first.
        const browserSuccess = await browserSpeak(cleanText, session);

        if (session !== speechSession || browserSuccess) return;

        // Fallback to ElevenLabs when configured on the server.
        try {
            const response = await fetch("/api/speech", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg"
                },
                body: JSON.stringify({ text: cleanText })
            });

            if (!response.ok) {
                console.error(
                    "SILI speech API failed:",
                    response.status,
                    await response.text().catch(() => "")
                );
                return;
            }

            const blob = await response.blob();
            if (!blob.size || session !== speechSession) return;

            audioUrl = URL.createObjectURL(blob);
            const playbackUrl = audioUrl;
            const audio = new Audio(playbackUrl);
            currentAudio = audio;

            audio.onended = () => {
                if (currentAudio === audio) currentAudio = null;
                if (audioUrl === playbackUrl) {
                    URL.revokeObjectURL(playbackUrl);
                    audioUrl = null;
                }
            };

            audio.onerror = () => {
                console.error("SILI: Audio playback failed.");
            };

            await audio.play();
            console.log("SILI: Speech API playback started.");
        } catch (error) {
            console.error("SILI speech playback failed:", error);
        }
    }

    function toggleListening(onResult, onError) {
        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            onError?.("Voice input is not supported in this browser. Try Chrome.");
            return;
        }

        if (listening && recognition) {
            recognition.stop();
            setMicState(false);
            return;
        }

        const instance = new SpeechRecognition();
        const session = ++speechSession;
        recognition = instance;

        instance.lang = "en-IN";
        instance.interimResults = true;
        instance.continuous = false;
        instance.maxAlternatives = 1;

        let finalTranscript = "";
        let resultSent = false;

        instance.onstart = () => setMicState(true);

        instance.onresult = event => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0]?.transcript || "";

                if (result.isFinal && transcript.trim()) {
                    finalTranscript += " " + transcript.trim();
                }
            }

            if (
                finalTranscript.trim() &&
                !resultSent &&
                session === speechSession
            ) {
                resultSent = true;
                onResult?.(finalTranscript.trim());
            }
        };

        instance.onerror = event => {
            setMicState(false);
            if (event.error === "aborted") return;

            const message =
                event.error === "not-allowed"
                    ? "Please allow microphone access in your browser."
                    : event.error === "no-speech"
                        ? "No speech detected. Tap the microphone and try again."
                        : `Voice input failed: ${event.error}`;

            onError?.(message);
        };

        instance.onend = () => {
            setMicState(false);
            if (recognition === instance) recognition = null;
        };

        try {
            instance.start();
        } catch (error) {
            setMicState(false);
            recognition = null;
            onError?.("Could not start microphone. Please try again.");
        }
    }

    return {
        speak,
        stopSpeaking,
        toggleListening
    };
})();
