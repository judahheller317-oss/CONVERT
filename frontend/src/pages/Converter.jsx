import { useCallback, useRef, useState } from "react";
import axios from "axios";
import Marquee from "react-fast-marquee";
import { toast } from "sonner";
import {
  UploadCloud,
  FileCheck2,
  Cpu,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VERSIONS = [
  { value: "2026", label: "After Effects 2026", internal: "v26.x" },
  { value: "2025", label: "After Effects 2025", internal: "v25.x" },
  { value: "2024", label: "After Effects 2024", internal: "v24.x" },
  { value: "2023", label: "After Effects 2023", internal: "v23.x" },
  { value: "2022", label: "After Effects 2022", internal: "v22.x" },
  { value: "2021", label: "After Effects 2021", internal: "v18.x" },
  { value: "2020", label: "After Effects 2020", internal: "v17.x" },
];

const ACCEPT = ".aepx,.aep";

export default function Converter() {
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState("2022");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const pickFile = (f) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".aepx") && !lower.endsWith(".aep")) {
      toast.error("Unsupported file. Upload a .aepx or .aep project file.");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }, []);

  const convert = async () => {
    if (!file) {
      toast.error("Please add a project file first.");
      return;
    }
    setProcessing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("target_version", target);
      const { data } = await axios.post(`${API}/convert`, form);
      setResult(data);
      toast.success(`Optimized for After Effects ${target}.`);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Conversion failed. Please try again.";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-bg min-h-screen text-slate-100 relative overflow-hidden">
      <div className="grid-overlay" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* Disclaimer marquee */}
      <div className="relative z-10 border-b border-white/10 bg-white/[0.02] backdrop-blur" data-testid="disclaimer-marquee">
        <Marquee speed={42} gradient={false} className="py-2">
          <span className="font-mono-ae text-[11px] tracking-[0.25em] uppercase text-slate-400 mx-10">
            Not affiliated with Adobe Inc. — Unofficial best-effort compatibility optimizer — Always keep a backup of your original project
          </span>
          <span className="font-mono-ae text-[11px] tracking-[0.25em] uppercase text-slate-400 mx-10">
            Not affiliated with Adobe Inc. — Unofficial best-effort compatibility optimizer — Always keep a backup of your original project
          </span>
        </Marquee>
      </div>

      {/* Header */}
      <header className="relative z-10">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center glow-ring">
              <Cpu className="h-5 w-5 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display font-extrabold text-lg leading-none tracking-tight uppercase text-glow">Skillzycord</p>
              <p className="font-mono-ae text-[10px] tracking-[0.3em] text-slate-500 uppercase">Converter</p>
            </div>
          </div>
          <button
            onClick={() => window.open(`${API}/sample`, "_blank")}
            data-testid="download-sample-button"
            className="font-mono-ae text-xs uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            Get sample .aepx →
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-16">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center fade-up">
          <span className="inline-flex items-center gap-2 font-mono-ae text-[11px] tracking-[0.3em] uppercase text-slate-300 border border-white/15 rounded-full px-4 py-1.5 glow-ring">
            <Sparkles className="h-3.5 w-3.5" /> XML project downgrader
          </span>
          <h1 className="font-display font-extrabold tracking-tight leading-[0.95] text-4xl sm:text-5xl md:text-6xl mt-7">
            Downgrade your <span className="text-glow">After Effects</span> projects.
          </h1>
          <p className="font-mono-ae text-sm sm:text-base text-slate-400 mt-6 leading-relaxed max-w-2xl mx-auto">
            Upload a project, pick an older target version, and we strip or swap unsupported effects so the file
            opens on legacy installs. Best-effort, never official.
          </p>
        </div>

        {/* Upload + config */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-14">
          {/* Upload zone */}
          <section className="lg:col-span-7 fade-up delay-1">
            <div
              data-testid="upload-zone"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`relative overflow-hidden cursor-pointer glass h-full min-h-[280px] px-8 py-16 flex flex-col items-center justify-center text-center transition-all duration-300 ${
                dragging ? "border-white/60 glow-ring scale-[1.01]" : "hover:border-white/30"
              } ${!file ? "scan-line" : ""}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                data-testid="file-input"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <FileCheck2 className="h-14 w-14 text-white text-glow" strokeWidth={1.4} />
                  <p className="font-mono-ae text-base text-white break-all max-w-md" data-testid="selected-filename">
                    {file.name}
                  </p>
                  <p className="font-mono-ae text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB · click to replace
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-5">
                  <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center pulse-soft glow-ring">
                    <UploadCloud className="h-9 w-9 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-display font-bold text-2xl tracking-tight">Upload project file</p>
                    <p className="font-mono-ae text-sm text-slate-500 mt-2">
                      drag &amp; drop or click to browse · .aepx / .aep
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Config panel */}
          <aside className="lg:col-span-5 fade-up delay-2">
            <div className="glass-strong h-full p-7 flex flex-col">
              <p className="font-mono-ae text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-4">Target version</p>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger
                  data-testid="target-version-dropdown"
                  className="rounded-xl bg-white/5 border-white/15 font-mono-ae h-12 text-base focus:ring-white/50"
                >
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-[#0a0a0a] border-white/15 font-mono-ae">
                  {VERSIONS.map((v) => (
                    <SelectItem key={v.value} value={v.value} data-testid={`version-option-${v.value}`} className="rounded-lg">
                      <span className="flex items-center justify-between w-full gap-4">
                        <span>{v.label}</span>
                        <span className="text-slate-500 text-xs">{v.internal}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-6 space-y-2.5 font-mono-ae text-xs text-slate-500 leading-relaxed">
                <p className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-white/60" /> removes effects newer than target</p>
                <p className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-white/60" /> swaps modern effects for legacy equivalents</p>
                <p className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-white/60" /> rewrites version metadata</p>
              </div>

              <div className="mt-auto pt-7 flex flex-col gap-3">
                <button
                  onClick={convert}
                  disabled={!file || processing}
                  data-testid="convert-button"
                  className="btn-glow font-display font-bold uppercase tracking-wide text-sm py-4 px-6 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      <Cpu className="h-4 w-4" /> Convert project
                    </>
                  )}
                </button>
                {file && (
                  <button
                    onClick={reset}
                    data-testid="reset-button"
                    className="font-mono-ae text-xs uppercase tracking-wider text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear file
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Result */}
        {result && <ResultCard result={result} />}
      </main>

      <footer className="relative z-10 border-t border-white/10 mt-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 font-mono-ae text-xs text-slate-600 flex flex-col sm:flex-row gap-2 justify-between">
          <span>Skillzycord Converter — unofficial. Adobe &amp; After Effects are trademarks of Adobe Inc.</span>
          <span>Temp files auto-deleted after 1 hour.</span>
        </div>
      </footer>
    </div>
  );
}

function ResultCard({ result }) {
  const dl = () => window.open(`${API}/download/${result.job_id}`, "_blank");
  const isAep = result.file_type === "aep";

  return (
    <section className="mt-14 max-w-2xl mx-auto fade-up" data-testid="results-panel">
      <div className="glass-strong glow-ring p-8 text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-white/5 flex items-center justify-center glow-ring pulse-soft">
          <CheckCircle2 className="h-8 w-8 text-white text-glow" />
        </div>
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight mt-5 text-glow">
          Conversion complete
        </h2>
        <p className="font-mono-ae text-sm text-slate-400 mt-2">
          Optimized for <span className="text-white">After Effects {result.target_version}</span>. Ready to download.
        </p>

        <div className="grid grid-cols-3 gap-3 mt-7">
          <Stat label="Detected" value={result.detected_version || "—"} />
          <Stat label="Target" value={result.target_version} />
          <Stat label="Type" value={isAep ? ".aep" : ".aepx"} />
        </div>

        <p className="font-mono-ae text-xs text-slate-500 mt-6 break-all" data-testid="output-filename">
          {result.output_filename}
        </p>

        <button
          onClick={dl}
          data-testid="download-button"
          className="btn-glow font-display font-bold uppercase tracking-wide text-sm py-4 px-8 inline-flex items-center justify-center gap-2 mt-6"
        >
          <Download className="h-4 w-4" /> Download {isAep ? ".aep" : ".aepx"}
        </button>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="glass rounded-xl py-4 px-3">
      <p className="font-mono-ae text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="font-display font-bold text-xl mt-1 text-white">{value}</p>
    </div>
  );
}
