import { useEffect, useState } from "react";

export type AIModelId = "gpt5" | "gpt5mini" | "gemini";

export const AI_MODELS: { id: AIModelId; label: string; icon: string; color: string; gateway: string }[] = [
  { id: "gpt5", label: "GPT-5", icon: "🧠", color: "#10A37F", gateway: "openai/gpt-5" },
  { id: "gpt5mini", label: "GPT-5 mini", icon: "⚡", color: "#2196F3", gateway: "openai/gpt-5-mini" },
  { id: "gemini", label: "Gemini", icon: "💎", color: "#4285F4", gateway: "google/gemini-3-flash-preview" },
];

const LS_KEY = "wcs_active_ai_model";
const EVT = "wcs:active-ai-model";

function read(): AIModelId {
  if (typeof window === "undefined") return "gemini";
  const v = localStorage.getItem(LS_KEY) as AIModelId | null;
  return v && AI_MODELS.some((m) => m.id === v) ? v : "gemini";
}

export function useActiveModel(): [AIModelId, (m: AIModelId) => void] {
  const [model, setModel] = useState<AIModelId>(read);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AIModelId>).detail;
      if (detail) setModel(detail);
    };
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);

  const update = (m: AIModelId) => {
    localStorage.setItem(LS_KEY, m);
    window.dispatchEvent(new CustomEvent(EVT, { detail: m }));
  };

  return [model, update];
}

export function modelMeta(id: AIModelId) {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[2];
}