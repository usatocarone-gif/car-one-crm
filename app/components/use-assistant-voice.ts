"use client";
import { useEffect, useRef, useState } from "react";

// Narrow types because recognition (including Safari's prefixed API) is not in lib.dom.
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const recognitionError = (error: string) => {
  if (["not-allowed", "service-not-allowed"].includes(error)) return "Microfono non autorizzato. Puoi abilitarlo nelle impostazioni del sito o scrivere la domanda.";
  if (error === "audio-capture") return "Microfono non disponibile. Controlla che sia collegato e libero.";
  if (error === "no-speech") return "Non ho sentito una domanda. Riprova o scrivila qui sotto.";
  if (error === "network") return "Dettatura non disponibile: controlla la connessione o scrivi la domanda.";
  return "Dettatura non riuscita. Riprova o scrivi la domanda.";
};

export function useAssistantVoice(onTranscript: (text: string) => void) {
  const [available, setAvailable] = useState(false), [readAvailable, setReadAvailable] = useState(false);
  const [listening, setListening] = useState(false), [speaking, setSpeaking] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const recognition = useRef<Recognition | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speech = useRef<SpeechSynthesisUtterance | null>(null), transcript = useRef(onTranscript);
  transcript.current = onTranscript;
  function clearTimer() { if (timer.current) clearTimeout(timer.current); timer.current = null; }
  function stopReading() {
    if (speech.current) { speech.current.onend = null; speech.current.onerror = null; speech.current = null; window.speechSynthesis.cancel(); }
    setSpeaking(null);
  }
  function cancelListening() {
    clearTimer();
    const current = recognition.current; recognition.current = null;
    if (current) { current.onend = null; current.onresult = null; current.onerror = null; current.abort(); }
    setListening(false);
  }
  function stopListening() {
    clearTimer();
    // stop() asks for the final transcript; keep controls locked until onend.
    try { recognition.current?.stop(); if (recognition.current) timer.current = setTimeout(cancelListening, 3000); } catch { cancelListening(); }
  }
  function startListening(draft: string) {
    if (recognition.current) return;
    const Constructor = (window as VoiceWindow).SpeechRecognition || (window as VoiceWindow).webkitSpeechRecognition;
    if (!Constructor) { setNotice("Questo browser non supporta la dettatura. Puoi usare il microfono della tastiera del telefono."); return; }
    stopReading(); setNotice("");
    try {
      const current = new Constructor(); recognition.current = current;
      current.lang = "it-IT"; current.continuous = false; current.interimResults = true; current.maxAlternatives = 1;
      let heard = false, failed = false;
      current.onresult = event => {
        if (recognition.current !== current) return;
        // Results are cumulative for this session: rebuild rather than append duplicates.
        const words = Array.from(event.results, result => result[0]?.transcript || "").join(" ").trim();
        if (words) { heard = true; transcript.current(`${draft.trim()}${draft.trim() ? " " : ""}${words}`.slice(0, 600)); }
      };
      current.onerror = event => {
        if (recognition.current !== current) return;
        failed = true;
        if (event.error !== "aborted") setNotice(recognitionError(event.error));
        // Some engines do not emit onend after a permission/service error.
        cancelListening();
      };
      current.onend = () => {
        if (recognition.current !== current) return;
        clearTimer(); recognition.current = null;
        current.onresult = null; current.onerror = null; current.onend = null;
        setListening(false);
        if (!heard && !failed) setNotice("Non ho sentito una domanda. Riprova o scrivila qui sotto.");
      };
      current.start(); setListening(true);
      timer.current = setTimeout(cancelListening, 45000);
    } catch { cancelListening(); setNotice("Non riesco ad avviare il microfono. Controlla i permessi del browser."); }
  }
  function read(id: number, text: string) {
    const wasSpeaking = speaking === id;
    stopReading(); cancelListening();
    if (wasSpeaking) return;
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    setNotice("");
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "it-IT"; utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const italian = voices.filter(v => v.lang.toLowerCase().startsWith("it"));
    const voice = italian.find(v => v.localService) || italian[0];
    if (voice) utterance.voice = voice;
    utterance.onend = () => { if (speech.current === utterance) { speech.current = null; setSpeaking(null); } };
    utterance.onerror = () => { if (speech.current === utterance) { speech.current = null; setSpeaking(null); setNotice("Lettura audio non disponibile. La risposta è visibile nella chat."); } };
    speech.current = utterance; setSpeaking(id);
    try { window.speechSynthesis.speak(utterance); } catch { stopReading(); setNotice("Lettura audio non disponibile."); }
  }
  useEffect(() => {
    const win = window as VoiceWindow;
    setAvailable(Boolean(win.SpeechRecognition || win.webkitSpeechRecognition));
    setReadAvailable("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    const hidden = () => { if (document.hidden) { cancelListening(); stopReading(); } };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); cancelListening(); stopReading(); };
  }, []);
  return { available, readAvailable, listening, speaking, notice, startListening, stopListening, cancelListening, stopReading, read };
}
