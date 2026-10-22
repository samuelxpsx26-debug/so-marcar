"use client";
import { useEffect } from "react";
import { ping } from "./presence-action";

/** Avisa que o painel está aberto, para o /admin mostrar quem está usando agora */
export function Presence() {
  useEffect(() => {
    const beat = () => { if (document.visibilityState === "visible") ping().catch(() => {}); };
    beat();
    const id = setInterval(beat, 120_000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", beat); };
  }, []);
  return null;
}
