export type Segment = "barbearia" | "salao" | "manicure" | "estetica" | "autonomo" | "personal" | "estudio" | "tatuagem" | "clinica" | "outro";

type SegmentInfo = { label: string; professional: string; background: string; suggestion: { primary: string; background: string } };

// Fundo padrão por nicho (degradês leves, sem impor estética: o dono troca cores e imagem quando quiser)
export const SEGMENTS: Record<Segment, SegmentInfo> = {
  barbearia: { label: "Barbearia", professional: "Barbeiro", background: "radial-gradient(circle at 20% 10%, #3b2a1a 0, transparent 50%), repeating-linear-gradient(135deg, #1a1410 0 14px, #20180f 14px 28px)", suggestion: { primary: "#d4a24c", background: "#14100c" } },
  salao: { label: "Salão de beleza", professional: "Cabeleireiro(a)", background: "radial-gradient(circle at 80% 0%, #5b2a4a 0, transparent 55%), radial-gradient(circle at 0% 100%, #2a1f4a 0, transparent 50%)", suggestion: { primary: "#e86fa6", background: "#1a1020" } },
  manicure: { label: "Manicure e pedicure", professional: "Manicure", background: "radial-gradient(circle at 10% 20%, #f9d5e5 0, transparent 45%), radial-gradient(circle at 90% 80%, #fde2c8 0, transparent 45%)", suggestion: { primary: "#c2416b", background: "#fff7fa" } },
  estetica: { label: "Estética", professional: "Esteticista", background: "radial-gradient(circle at 80% 10%, #d8f3ec 0, transparent 50%), radial-gradient(circle at 10% 90%, #e8e1f7 0, transparent 50%)", suggestion: { primary: "#2f8f7a", background: "#f6fbfa" } },
  autonomo: { label: "Profissional autônomo", professional: "Profissional", background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 60%)", suggestion: { primary: "#4f46e5", background: "#f8fafc" } },
  personal: { label: "Personal trainer", professional: "Personal", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%), repeating-linear-gradient(90deg, transparent 0 40px, #ffffff08 40px 41px)", suggestion: { primary: "#22c55e", background: "#0b1220" } },
  estudio: { label: "Estúdio (pilates, yoga, dança)", professional: "Instrutor(a)", background: "radial-gradient(circle at 50% 0%, #fff1d6 0, transparent 60%)", suggestion: { primary: "#d97706", background: "#fffbf3" } },
  tatuagem: { label: "Tatuagem e piercing", professional: "Tatuador(a)", background: "radial-gradient(circle at 30% 20%, #3a0d0d 0, transparent 50%), linear-gradient(180deg, #0a0a0a, #151515)", suggestion: { primary: "#ef4444", background: "#0a0a0a" } },
  clinica: { label: "Clínica e saúde", professional: "Profissional", background: "linear-gradient(180deg, #eff8ff 0%, #ffffff 70%)", suggestion: { primary: "#0284c7", background: "#ffffff" } },
  outro: { label: "Outro", professional: "Profissional", background: "linear-gradient(180deg, #f4f4f5 0%, #ffffff 70%)", suggestion: { primary: "#7c3aed", background: "#ffffff" } },
};

export const SEGMENT_OPTIONS = (Object.keys(SEGMENTS) as Segment[]).map((k) => ({ value: k, label: SEGMENTS[k].label }));
