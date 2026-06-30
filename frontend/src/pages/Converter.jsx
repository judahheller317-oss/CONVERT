import { useCallback, useRef, useState } from "react";
import axios from "axios";
import Marquee from "react-fast-marquee";
import { toast } from "sonner";
import {
  UploadCloud,
  FileCode2,
  Cpu,
  Download,
  FileArchive,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Boxes,
  Replace,
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
    if (lower.endsWith(".aep")) {
      toast.warning("Binary .aep detected — limited (detection-only) support. .aepx is recommended.");
    }
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
      toast.success(`Optimized for AE ${target} — ${data.total_changes} change(s) applied.`);
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

  const downloadSample = () => {
    window.open(`${API}/sample`, "_blank");
  };

  return (
    <div className="min-h-screen grid-bg text-slate-100">
      {/* Disclaimer marquee */}
      <div className="bg-yellow-500 text-black border-b-2 border-black" data-testid="disclaimer-marquee">
        <Marquee speed={48} gradient={false} className="py-1.5">
          <span className="font-mono-ae text-xs font-semibold uppercase tracking-[0.15em] mx-8">
            Not affiliated with Adobe Inc. • Unofficial best-effort compatibility optimizer • Always keep a backup of your original project • Use at your own risk
          </span>
          <span className="font-mono-ae text-xs font-semibold uppercase tracking-[0.15em] mx-8">
            Not affiliated with Adobe Inc. • Unofficial best-effort compatibility optimizer • Always keep a backup of your original project • Use at your own risk
          </span>
        </Marquee>
      </div>

      {/* Header */}
      <header className="border-b border-[#222] bg-black/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-yellow-500 flex items-center justify-center">
              <Cpu className="h-5 w-5 text-black" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-display font-black text-lg leading-none tracking-tight uppercase">AE Compat</p>
              <p className="font-mono-ae text-[10px] tracking-[0.25em] text-slate-500 uppercase">Converter v1.0</p>
            </div>
          </div>
          <button
            onClick={downloadSample}
            data-testid="download-sample-button"
            className="font-mono-ae text-xs uppercase tracking-wider text-slate-400 hover:text-yellow-400 transition-colors"
          >
            Get sample .aepx →
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-16">
        {/* Hero */}
        <div className="max-w-3xl fade-up">
          <p className="font-mono-ae text-xs tracking-[0.25em] uppercase text-yellow-500 mb-4">
            // XML project downgrader
          </p>
          <h1 className="font-display font-black uppercase tracking-tight leading-none text-4xl sm:text-5xl md:text-6xl">
            Downgrade your <span className="text-yellow-500">After Effects</span> projects.
          </h1>
          <p className="font-mono-ae text-sm sm:text-base text-slate-400 mt-6 leading-relaxed">
            Upload an <span className="text-slate-200">.aepx</span> project, pick an older target version, and we strip or
            swap unsupported effects so the file opens on legacy installs. Best-effort, never official.
          </p>
        </div>

        {/* Grid: upload (dominant) + config */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-12">
          {/* Upload zone */}
          <section className="lg:col-span-8">
            <div
              data-testid="upload-zone"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`cursor-pointer border-2 border-dashed bg-[#0a0a0a] transition-all duration-150 px-8 py-14 md:py-20 flex flex-col items-center justify-center text-center ${
                dragging ? "border-yellow-500 bg-yellow-500/5" : "border-[#333] hover:border-yellow-500/70"
              }`}
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
                  <FileCode2 className="h-12 w-12 text-yellow-500" strokeWidth={1.5} />
                  <p className="font-mono-ae text-base text-slate-100 break-all max-w-md" data-testid="selected-filename">
                    {file.name}
                  </p>
                  <p className="font-mono-ae text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB · click to replace
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <UploadCloud className={`h-14 w-14 ${dragging ? "text-yellow-500" : "text-slate-600"}`} strokeWidth={1.5} />
                  <div>
                    <p className="font-display font-bold text-xl uppercase tracking-tight">Drop project file here</p>
                    <p className="font-mono-ae text-sm text-slate-500 mt-2">
                      or click to browse · <span className="text-slate-300">.aepx</span> recommended · .aep supported
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Config panel */}
          <aside className="lg:col-span-4">
            <div className="border border-[#222] bg-[#111] h-full p-6 flex flex-col">
              <p className="font-mono-ae text-xs tracking-[0.2em] uppercase text-slate-500 mb-4">Target version</p>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger
                  data-testid="target-version-dropdown"
                  className="rounded-none bg-[#0a0a0a] border-[#333] font-mono-ae h-12 text-base focus:ring-yellow-500"
                >
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent className="rounded-none bg-[#111] border-[#333] font-mono-ae">
                  {VERSIONS.map((v) => (
                    <SelectItem key={v.value} value={v.value} data-testid={`version-option-${v.value}`} className="rounded-none">
                      <span className="flex items-center justify-between w-full gap-4">
                        <span>{v.label}</span>
                        <span className="text-slate-500 text-xs">{v.internal}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-6 space-y-2 font-mono-ae text-xs text-slate-500 leading-relaxed">
                <p>· removes effects newer than target</p>
                <p>· swaps modern effects for legacy equals</p>
                <p>· rewrites version metadata</p>
              </div>

              <div className="mt-auto pt-6 flex flex-col gap-3">
                <button
                  onClick={convert}
                  disabled={!file || processing}
                  data-testid="convert-button"
                  className="btn-press bg-yellow-500 text-black font-display font-bold uppercase tracking-wide text-sm py-4 px-6 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
                    className="font-mono-ae text-xs uppercase tracking-wider text-slate-500 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear file
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* Results terminal */}
        {result && <ResultsPanel result={result} />}
      </main>

      <footer className="border-t border-[#222] mt-16">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 font-mono-ae text-xs text-slate-600 flex flex-col sm:flex-row gap-2 justify-between">
          <span>AE Compatibility Converter — unofficial tool. Adobe & After Effects are trademarks of Adobe Inc.</span>
          <span>Temp files auto-deleted after 1 hour.</span>
        </div>
      </footer>
    </div>
  );
}

function ResultsPanel({ result }) {
  const dl = (suffix = "") => window.open(`${API}/download/${result.job_id}${suffix}`, "_blank");
  const isAep = result.file_type === "aep";

  return (
    <section className="mt-12 fade-up" data-testid="results-panel">
      <div className="border border-[#333] bg-black">
        {/* Terminal title bar */}
        <div className="flex items-center justify-between border-b border-[#333] px-4 py-2.5 bg-[#0a0a0a]">
          <div className="flex items-center gap-2 font-mono-ae text-xs text-slate-400">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-3 uppercase tracking-wider">conversion_report.log</span>
          </div>
          <span className="font-mono-ae text-xs text-slate-600 truncate max-w-[40%]">{result.output_filename}</span>
        </div>

        <div className="p-6 font-mono-ae text-sm space-y-6">
          {/* Summary line */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#222] border border-[#222]">
            <Stat label="Detected" value={result.detected_version || "Unknown"} />
            <Stat label="Target" value={`AE ${result.target_version}`} accent />
            <Stat label="Changes" value={result.total_changes} />
            <Stat label="Type" value={isAep ? ".aep (binary)" : ".aepx (xml)"} />
          </div>

          {/* Removed */}
          <Block icon={<Boxes className="h-4 w-4 text-red-400" />} title="Removed effects" count={result.removed_effects?.length || 0}>
            {result.removed_effects?.length ? (
              result.removed_effects.map((r, i) => (
                <p key={i} className="text-red-300/90" data-testid={`removed-effect-${i}`}>
                  <span className="text-slate-600">-</span> {r.name}{" "}
                  <span className="text-slate-600">({r.matchname}) ×{r.count}</span>
                </p>
              ))
            ) : (
              <p className="text-slate-600">No unsupported effects found to remove.</p>
            )}
          </Block>

          {/* Replaced */}
          <Block icon={<Replace className="h-4 w-4 text-yellow-400" />} title="Replaced effects" count={result.replaced_effects?.length || 0}>
            {result.replaced_effects?.length ? (
              result.replaced_effects.map((r, i) => (
                <p key={i} className="text-yellow-200/90 flex items-center gap-2 flex-wrap" data-testid={`replaced-effect-${i}`}>
                  {r.from_name} <ArrowRight className="h-3 w-3 inline text-slate-600" /> {r.to_name}
                  <span className="text-slate-600">×{r.count}</span>
                </p>
              ))
            ) : (
              <p className="text-slate-600">No effects required replacement.</p>
            )}
          </Block>

          {/* Detection-only (aep) */}
          {isAep && result.detected_unsupported?.length > 0 && (
            <Block icon={<AlertTriangle className="h-4 w-4 text-orange-400" />} title="Detected (not removed)" count={result.detected_unsupported.length}>
              {result.detected_unsupported.map((r, i) => (
                <p key={i} className="text-orange-300/90">
                  <span className="text-slate-600">!</span> {r.name} <span className="text-slate-600">×{r.count}</span>
                </p>
              ))}
            </Block>
          )}

          {/* Warnings */}
          {result.warnings?.length > 0 && (
            <Block icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />} title="Warnings" count={result.warnings.length}>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-slate-400" data-testid={`warning-${i}`}>
                  <span className="text-yellow-600">!</span> {w}
                </p>
              ))}
            </Block>
          )}

          {/* Success line */}
          <div className="flex items-center gap-2 text-green-400 pt-2 border-t border-[#222]">
            <CheckCircle2 className="h-4 w-4" />
            <span>Done. Output ready for download.</span>
          </div>

          {/* Download buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => dl("")}
              data-testid="download-button"
              className="btn-press bg-yellow-500 text-black font-display font-bold uppercase tracking-wide text-sm py-3.5 px-6 flex items-center justify-center gap-2 flex-1"
            >
              <Download className="h-4 w-4" /> Download {isAep ? ".aep" : ".aepx"}
            </button>
            <button
              onClick={() => dl("/zip")}
              data-testid="download-zip-button"
              className="border border-[#333] bg-[#111] text-slate-200 hover:border-yellow-500 transition-colors font-display font-bold uppercase tracking-wide text-sm py-3.5 px-6 flex items-center justify-center gap-2 flex-1"
            >
              <FileArchive className="h-4 w-4" /> Download .zip + report
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="bg-[#0a0a0a] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">{label}</p>
      <p className={`text-lg font-display font-bold mt-1 ${accent ? "text-yellow-500" : "text-slate-100"}`}>{value}</p>
    </div>
  );
}

function Block({ icon, title, count, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="uppercase tracking-wider text-xs text-slate-400">{title}</span>
        <span className="text-slate-600 text-xs">[{count}]</span>
      </div>
      <div className="pl-6 space-y-1 leading-relaxed">{children}</div>
    </div>
  );
}
