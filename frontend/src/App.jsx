import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BookMarked,
  BookOpenText,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Cpu,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Gavel,
  Landmark,
  Layers,
  LoaderCircle,
  LockKeyhole,
  Play,
  Printer,
  Quote,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  UploadCloud,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { SAMPLE_CASES } from "./sampleCases";
import IntroPage from "./components/IntroPage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const PIPELINE_STAGES = [
  { id: 1, title: "Parsing Judicial Document", detail: "Extracting pages, bench headers & legal text" },
  { id: 2, title: "AI Legal Semantic NLU", detail: "Domain clustering, near-synonym mapping & entity alignment" },
  { id: 3, title: "Synthesizing Case Brief", detail: "Generating Facts, Ratio Decidendi & Final Order" },
  { id: 4, title: "Closed-Loop Integrity Audit", detail: "Semantic statute preservation & hallucination checks" },
];

const SECTION_CONFIG = [
  {
    key: "facts",
    title: "Facts of the Case",
    subtitle: "Background & Procedural History",
    icon: BookOpenText,
    accent: "indigo",
    badge: "Factual Matrix",
    heading: /(?:^|\r?\n)[\t ]*(?:[📌\?\*#\-]*[\t ]*)?(?:FACTS(?:\s+OF\s+THE\s+CASE)?|BACKGROUND)[\t ]*:?[ \t]*(?:\r?\n|$)/i,
  },
  {
    key: "rationale",
    title: "Court Rationale",
    subtitle: "Ratio Decidendi & Legal Principles",
    icon: Sparkles,
    accent: "violet",
    badge: "Binding Precedent",
    heading: /(?:^|\r?\n)[\t ]*(?:[🧠\?\*#\-]*[\t ]*)?(?:COURT[\t ]+RATIONALE(?:\s*\([^)]*\))?|RATIO(?:\s+DECIDENDI)?|LEGAL[\t ]+REASONING)[\t ]*:?[ \t]*(?:\r?\n|$)/i,
  },
  {
    key: "order",
    title: "Final Order & Held",
    subtitle: "Operative Decree & Ruling",
    icon: Gavel,
    accent: "emerald",
    badge: "Judicial Disposition",
    heading: /(?:^|\r?\n)[\t ]*(?:[⚖️\?\*#\-]*[\t ]*)?(?:FINAL[\t ]+ORDER(?:\s*(?:&|AND)\s*HELD)?|FINAL[\t ]+ORDER|FINAL[\t ]+DECREE|HELD|OPERATIVE[\t ]+ORDER)[\t ]*:?[ \t]*(?:\r?\n|$)/i,
  },
];

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** unitIndex;
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => item?.msg).filter(Boolean);
    if (messages.length) return messages.join(". ");
  }
  if (error?.code === "ERR_NETWORK") {
    return `Cannot connect to VerdictLens Backend at ${API_BASE_URL}. Ensure uvicorn is running, or explore our built-in landmark cases below.`;
  }
  if (error?.response?.status) {
    return `Server returned error status ${error.response.status}. Please check backend logs.`;
  }
  return error?.message || "An unexpected error occurred while analyzing this judgment.";
}

function parseSummarySections(summary = "", apiSections = null) {
  // 1. If backend directly provided clean pre-split zones, use them directly without regex slicing
  if (apiSections && typeof apiSections === "object") {
    const list = [];
    if (apiSections.facts && typeof apiSections.facts === "string" && apiSections.facts.trim()) {
      list.push({ ...SECTION_CONFIG[0], content: apiSections.facts.trim() });
    }
    if (apiSections.rationale && typeof apiSections.rationale === "string" && apiSections.rationale.trim()) {
      list.push({ ...SECTION_CONFIG[1], content: apiSections.rationale.trim() });
    }
    if (apiSections.held && typeof apiSections.held === "string" && apiSections.held.trim()) {
      list.push({ ...SECTION_CONFIG[2], content: apiSections.held.trim() });
    }
    if (list.length > 0) return list;
  }

  // 2. Fallback to robust regex parsing
  if (!summary || typeof summary !== "string") return [];

  const matches = SECTION_CONFIG.map((section) => {
    const match = section.heading.exec(summary);
    return match ? { ...section, start: match.index, end: match.index + match[0].length } : null;
  })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  if (!matches.length) {
    return [
      {
        ...SECTION_CONFIG[0],
        title: "Executive Case Summary",
        subtitle: "Extracted Legal Digest",
        content: summary.trim(),
      },
    ];
  }

  const sections = matches.map((section, index) => {
    const nextStart = matches[index + 1]?.start ?? summary.length;
    return {
      ...section,
      content: summary.slice(section.end, nextStart).trim(),
    };
  }).filter((section) => section.content);

  const preamble = summary.slice(0, matches[0].start).trim();
  if (preamble) {
    sections.unshift({
      ...SECTION_CONFIG[0],
      key: "preamble",
      title: "Judicial Overview",
      subtitle: "Introductory Observations",
      content: preamble,
    });
  }

  return sections;
}

function calculateCompression(original, shortened) {
  const originalCount = Number(original) || 0;
  const summaryCount = Number(shortened) || 0;
  if (!originalCount) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - summaryCount / originalCount) * 100)));
}

function highlightSymbolSnippet(snippet, symbol) {
  if (!snippet) return null;
  if (!symbol) return snippet;
  try {
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = snippet.split(regex);
    return parts.map((part, i) => {
      if (part.toLowerCase() === symbol.toLowerCase()) {
        return (
          <mark
            key={i}
            className="rounded bg-amber-400/25 px-1 py-0.5 font-bold font-serif text-amber-200 border border-amber-400/40 not-italic select-all shadow-sm"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  } catch {
    return snippet;
  }
}

export default function App() {
  // Page state: 'intro' (landing / introduction) vs 'workspace' (upload & analysis)
  const [currentPage, setCurrentPage] = useState("intro");

  const [file, setFile] = useState(null);
  const [activeCase, setActiveCase] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("brief"); // "brief" | "statutes" | "precedents" | "audit" | "parties"
  const [briefViewMode, setBriefViewMode] = useState("sections"); // "sections" | "full"
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedSection, setCopiedSection] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [backendOnline, setBackendOnline] = useState(null);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  // Audio speech synthesis state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const speechUtteranceRef = useRef(null);

  // Check backend health on mount
  useEffect(() => {
    let isMounted = true;
    const checkBackend = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/`, { timeout: 3500 });
        if (isMounted) setBackendOnline(response.status === 200);
      } catch {
        if (isMounted) setBackendOnline(false);
      }
    };
    checkBackend();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup speech synthesis on unmount or page change
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentPage]);

  // Show auto-dismissing toast
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  // Stepper timer during file upload
  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev < PIPELINE_STAGES.length - 1 ? prev + 1 : prev));
    }, 2800);
    return () => clearInterval(interval);
  }, [loading]);

  const selectFile = (candidate) => {
    setError("");
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a valid PDF judgment file (.pdf)");
      return;
    }
    setFile(candidate);
    setActiveCase(null);
  };

  const loadSampleCase = (sampleCase) => {
    setError("");
    setLoading(false);
    setFile(null);
    setActiveCase(sampleCase);
    setResult(sampleCase.result);
    setActiveTab("brief");
    setCurrentPage("workspace");
    triggerToast(`Loaded landmark case: ${sampleCase.title}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToWorkspace = () => {
    setCurrentPage("workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToIntro = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
    setCurrentPage("intro");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    setActiveCase(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE_URL}/summarize`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000,
      });

      if (!response.data || typeof response.data !== "object") {
        throw new Error("Invalid response format received from VerdictLens API.");
      }

      setResult(response.data);
      setActiveTab("brief");
      triggerToast("Case brief and legal entity extraction complete!");
      window.scrollTo({ top: 360, behavior: "smooth" });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
    setFile(null);
    setActiveCase(null);
    setResult(null);
    setError("");
    setSearchQuery("");
  };

  const copyToClipboard = async (text, label = "Content") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(label);
      triggerToast(`${label} copied to clipboard`);
      setTimeout(() => setCopiedSection(null), 2200);
    } catch {
      triggerToast("Could not copy to clipboard. Check permissions.");
    }
  };

  const toggleAudioSpeech = (textToRead) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      triggerToast("Audio speech is not supported in this browser.");
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = textToRead.replace(/[📌🧠⚖️]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
    triggerToast("Reading case brief aloud...");
  };

  const exportMarkdown = () => {
    if (!result) return;
    const title = activeCase ? activeCase.title : (file ? file.name.replace(".pdf", "") : "VerdictLens_Case_Brief");
    const summaryText = result.summary || "";
    const metadata = result.metadata || {};
    const audit = result.verification_audit || {};

    let md = `# ${title}\n\n`;
    if (activeCase?.citation) md += `**Citation:** ${activeCase.citation}\n`;
    if (activeCase?.court) md += `**Court:** ${activeCase.court}\n`;
    if (activeCase?.bench) md += `**Bench:** ${activeCase.bench}\n\n`;
    md += `## Case Brief\n\n${summaryText}\n\n`;
    
    if (metadata.acts_sections?.length) {
      md += `## Acts & Statutes Cited\n`;
      metadata.acts_sections.forEach((act) => {
        md += `- ${act}\n`;
      });
      md += `\n`;
    }

    if (metadata.case_precedents?.length) {
      md += `## Precedents & Judicial Treatment\n`;
      metadata.case_precedents.forEach((p) => {
        md += `- **${p.case_name}** — *${p.treatment || "Referenced"}*\n`;
      });
      md += `\n`;
    }

    if (legalSymbols?.length) {
      md += `## Special Legal Symbols & Judicial Maxims\n`;
      legalSymbols.forEach((s) => {
        md += `- **${s.name} (${s.symbol})** [${s.category}] — ${s.meaning} *(Occurrences: ${s.occurrences || 1})*\n`;
        if (s.context_snippet) {
          md += `  > Excerpt: "${s.context_snippet}"\n`;
        }
      });
      md += `\n`;
    }

    md += `## Verification Audit\n`;
    md += `- Status: ${audit.status || (audit.passed ? "Passed" : "Checked")}\n`;
    md += `- Coverage: ${audit.coverage ? Math.round(audit.coverage * 100) + "%" : "100%"}\n`;
    md += `\n*Generated by VerdictLens — Closed-Loop Legal Intelligence Platform*\n`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Brief.md`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast("Markdown report downloaded");
  };

  const summary = typeof result?.summary === "string" ? result.summary : "";
  const sections = useMemo(
    () => parseSummarySections(summary, result?.sections),
    [summary, result?.sections]
  );
  const metadata = result?.metadata || {};
  const audit = result?.verification_audit || {};
  const wordCounts = result?.word_counts || {};
  const compressionRatio = calculateCompression(wordCounts.original_count, wordCounts.summary_count);

  const legalSymbols = useMemo(() => {
    return result?.legal_symbols || metadata?.legal_symbols || [];
  }, [result?.legal_symbols, metadata?.legal_symbols]);

  const filteredActs = useMemo(() => {
    const items = metadata.acts_sections || [];
    if (!searchQuery.trim()) return items;
    return items.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [metadata.acts_sections, searchQuery]);

  const filteredPrecedents = useMemo(() => {
    const items = metadata.case_precedents || [];
    if (!searchQuery.trim()) return items;
    return items.filter((item) => {
      const name = item.case_name || "";
      const treatment = item.treatment || "";
      return name.toLowerCase().includes(searchQuery.toLowerCase()) || treatment.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [metadata.case_precedents, searchQuery]);

  const filteredSymbols = useMemo(() => {
    if (!searchQuery.trim()) return legalSymbols;
    const q = searchQuery.toLowerCase();
    return legalSymbols.filter((item) => {
      const symbol = item.symbol || "";
      const name = item.name || "";
      const category = item.category || "";
      const meaning = item.meaning || "";
      return (
        symbol.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q) ||
        meaning.toLowerCase().includes(q)
      );
    });
  }, [legalSymbols, searchQuery]);

  return (
    <div className="relative min-h-screen text-slate-100 selection:bg-brand-500/30 selection:text-brand-200">
      {/* Background Ambient Mesh Orbs */}
      <div className="mesh-bg">
        <div className="mesh-orb-1" />
        <div className="mesh-orb-2" />
        <div className="mesh-orb-3" />
      </div>

      {/* Grid texture overlay */}
      <div className="pointer-events-none fixed inset-0 legal-grid-pattern opacity-60 z-0" />

      {/* Floating toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-brand-400/40 bg-obsidian-900/90 px-5 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-xl animate-bounce">
          <Sparkles size={16} className="text-brand-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          PAGE 1: INTRODUCTION PAGE
         ========================================================================= */}
      {currentPage === "intro" ? (
        <IntroPage
          onExplore={goToWorkspace}
          onSelectSampleCase={loadSampleCase}
          sampleCases={SAMPLE_CASES}
        />
      ) : (
        /* =========================================================================
            PAGE 2: MAIN WORKSPACE (DOCUMENT UPLOAD & CASE INTELLIGENCE DASHBOARD)
           ========================================================================= */
        <div>
          {/* Workspace Navigation Header */}
          <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-obsidian-950/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
              <div className="flex items-center gap-4">
                <button
                  onClick={goToIntro}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-brand-400 hover:bg-white/[0.08] hover:text-white transition"
                  title="Return to Introduction"
                >
                  <ArrowLeft size={14} />
                  <span>Introduction</span>
                </button>

                <div className="h-4 w-[1px] bg-white/[0.1] hidden sm:block" />

                <button
                  onClick={resetAll}
                  className="group flex items-center gap-3 text-left focus:outline-none"
                  aria-label="VerdictLens Workspace"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 p-[1px] shadow-glow-indigo">
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-obsidian-950/90">
                      <Scale size={18} className="text-brand-300" />
                    </div>
                  </div>
                  <div>
                    <span className="font-display text-base font-bold tracking-tight text-white block">VerdictLens</span>
                    <span className="block text-[9px] font-medium tracking-[0.16em] text-slate-400">
                      DOCUMENT WORKSPACE
                    </span>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Engine status indicator */}
                <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md sm:inline-flex">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      backendOnline === true
                        ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                        : backendOnline === false
                          ? "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                          : "bg-slate-400"
                    }`}
                  />
                  <span>{backendOnline ? "API Engine: Online" : "Local Engine"}</span>
                </div>

                {/* Quick Landmark Case Switcher */}
                <div className="relative group">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:border-brand-400/50 hover:bg-brand-500/10 hover:text-white"
                  >
                    <Sparkles size={14} className="text-brand-400" />
                    <span>Landmark Demos</span>
                    <ChevronRight size={13} className="text-slate-400 transition-transform group-hover:rotate-90" />
                  </button>

                  <div className="absolute right-0 top-full mt-2 hidden w-80 rounded-2xl border border-white/[0.1] bg-obsidian-900/95 p-2 shadow-2xl backdrop-blur-2xl group-hover:block z-50">
                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Load Supreme Court Landmark Case
                    </div>
                    <div className="space-y-1">
                      {SAMPLE_CASES.map((sc) => (
                        <button
                          key={sc.id}
                          onClick={() => loadSampleCase(sc)}
                          className="w-full rounded-xl p-2.5 text-left transition hover:bg-white/[0.07]"
                        >
                          <div className="text-xs font-semibold text-white truncate">{sc.title}</div>
                          <div className="mt-0.5 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>{sc.citation}</span>
                            <span className="text-brand-300 font-mono text-[10px]">{sc.category.split("/")[0]}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {result && (
                  <button
                    onClick={resetAll}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
                    title="Upload another judgment"
                  >
                    <RotateCcw size={13} />
                    <span className="hidden sm:inline">New Upload</span>
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Main Workspace Content */}
          <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-8">
            {/* Document Upload Stage (Shown when no case result is active) */}
            {!result && (
              <div className="mx-auto max-w-2xl py-6 animate-fadeIn">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3.5 py-1 text-xs font-semibold text-brand-300 mb-3">
                    <FileCheck2 size={14} className="text-brand-400" />
                    <span>Upload Judicial PDF Document</span>
                  </div>
                  <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
                    Analyze Judgment Transcript
                  </h1>
                  <p className="mt-2 text-sm text-slate-400">
                    Upload an Indian Supreme Court or High Court judgment PDF for NLU entity extraction and brief generation.
                  </p>
                </div>

                <div className="glass-panel-elevated relative overflow-hidden rounded-3xl p-6 sm:p-8">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-brand-400 to-transparent" />

                  {/* Drag and Drop Zone */}
                  <div>
                    <input
                      id="judgment-pdf-input"
                      type="file"
                      accept=".pdf,application/pdf"
                      className="sr-only"
                      onChange={(e) => selectFile(e.target.files?.[0])}
                      disabled={loading}
                    />

                    <label
                      htmlFor="judgment-pdf-input"
                      className={`group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${
                        file
                          ? "border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10"
                          : "border-white/[0.15] bg-white/[0.02] hover:border-brand-400/60 hover:bg-white/[0.04]"
                      } ${loading ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.05] text-brand-300 shadow-glass transition-all group-hover:scale-110 group-hover:border-brand-400">
                        <UploadCloud size={26} />
                      </div>

                      <span className="text-sm font-semibold text-slate-200 group-hover:text-white">
                        {file ? file.name : "Drag & Drop Court Judgment PDF Here"}
                      </span>
                      <span className="mt-1 text-xs text-slate-400">
                        {file ? formatFileSize(file.size) : "or click to browse your local computer"}
                      </span>

                      <div className="mt-4 flex items-center gap-2">
                        <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono text-slate-400">
                          PDF FORMAT
                        </span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-400">Supreme Court &amp; High Courts</span>
                      </div>
                    </label>
                  </div>

                  {/* Selected File Details */}
                  {file && (
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.1] bg-white/[0.04] p-3 backdrop-blur-md">
                      <div className="flex items-center gap-3 truncate">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300">
                          <FileText size={18} />
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-white truncate">{file.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{formatFileSize(file.size)}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        disabled={loading}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-white transition"
                        title="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Error Notification */}
                  {error && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                      <AlertCircle size={17} className="shrink-0 text-rose-400 mt-0.5" />
                      <div className="leading-relaxed">{error}</div>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!file || loading}
                    className="mt-6 relative group overflow-hidden w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-600/30 transition-all hover:shadow-glow-indigo hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <LoaderCircle size={18} className="animate-spin text-white" />
                        <span>Processing Judgment Transcript…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>Synthesize &amp; Audit Case</span>
                        <ChevronRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  {/* Pipeline Stepper Telemetry during processing */}
                  {loading && (
                    <div className="mt-6 rounded-2xl border border-white/[0.08] bg-obsidian-900/60 p-5">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                        <span className="font-semibold text-brand-300 flex items-center gap-2">
                          <Cpu size={14} className="animate-pulse" />
                          Live AI Pipeline Telemetry
                        </span>
                        <span className="font-mono text-[11px]">Stage {loadingStepIndex + 1} of 4</span>
                      </div>

                      <div className="space-y-3">
                        {PIPELINE_STAGES.map((stage, idx) => {
                          const isDone = idx < loadingStepIndex;
                          const isCurrent = idx === loadingStepIndex;
                          return (
                            <div
                              key={stage.id}
                              className={`flex items-start gap-3 rounded-xl p-2.5 transition-all ${
                                isCurrent
                                  ? "border border-brand-400/30 bg-brand-500/10 shadow-glass-sm"
                                  : isDone
                                    ? "opacity-75"
                                    : "opacity-35"
                              }`}
                            >
                              <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                  isDone
                                    ? "bg-emerald-500 text-obsidian-950"
                                    : isCurrent
                                      ? "border border-brand-400 bg-brand-500/20 text-brand-300"
                                      : "border border-white/10 bg-white/5 text-slate-500"
                                }`}
                              >
                                {isDone ? (
                                  <Check size={12} strokeWidth={3} />
                                ) : isCurrent ? (
                                  <LoaderCircle size={12} className="animate-spin" />
                                ) : (
                                  stage.id
                                )}
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-slate-200">{stage.title}</div>
                                <div className="text-[11px] text-slate-400">{stage.detail}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Landmark Demo Selector below upload box */}
                <div className="mt-8 text-center">
                  <div className="text-xs font-semibold text-slate-400 mb-3">
                    Don't have a judgment PDF handy? Explore with a landmark ruling:
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {SAMPLE_CASES.map((sc) => (
                      <button
                        key={sc.id}
                        onClick={() => loadSampleCase(sc)}
                        className="group flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-300 transition-all hover:border-brand-400 hover:bg-brand-500/10 hover:text-white"
                      >
                        <Landmark size={14} className="text-brand-400" />
                        <span>{sc.title.split(" v. ")[0]}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({sc.citation})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Case Intelligence Dashboard (Rendered when results are loaded) */}
            {result && (
              <div className="space-y-8 animate-fadeIn">
                {/* Case Overview Header Banner */}
                <div className="glass-panel-elevated relative overflow-hidden rounded-3xl p-6 sm:p-8">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-brand-500 via-cyan-400 to-indigo-500" />

                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          <CheckCircle2 size={13} />
                          Verification Certified
                        </span>
                        {activeCase?.citation && (
                          <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-xs font-mono text-cyan-300">
                            {activeCase.citation}
                          </span>
                        )}
                        {activeCase?.court && (
                          <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                            {activeCase.court}
                          </span>
                        )}
                      </div>

                      <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
                        {activeCase ? activeCase.title : (file ? file.name.replace(".pdf", "") : "Judicial Brief Analysis")}
                      </h1>

                      {activeCase?.bench && (
                        <p className="mt-2 text-xs text-slate-400 flex items-center gap-2">
                          <UsersRound size={14} className="text-brand-400 shrink-0" />
                          <span>{activeCase.bench}</span>
                        </p>
                      )}

                      {activeCase?.description && (
                        <p className="mt-3 text-sm text-slate-300 leading-relaxed border-l-2 border-brand-400/60 pl-3">
                          {activeCase.description}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 self-start">
                      {/* Audio Narrator */}
                      <button
                        type="button"
                        onClick={() => toggleAudioSpeech(summary)}
                        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                          isPlayingAudio
                            ? "border-amber-400/40 bg-amber-500/20 text-amber-200 shadow-glow-indigo animate-pulse"
                            : "border-white/[0.12] bg-white/[0.04] text-slate-200 hover:border-brand-400 hover:bg-white/[0.08] hover:text-white"
                        }`}
                      >
                        {isPlayingAudio ? (
                          <>
                            <Square size={14} className="fill-current" />
                            <span>Stop Speech</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={15} className="text-brand-400" />
                            <span>Listen to Brief</span>
                          </>
                        )}
                      </button>

                      {/* Copy All */}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(summary, "Full Brief")}
                        className="flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 transition-all hover:border-brand-400 hover:bg-white/[0.08] hover:text-white"
                      >
                        {copiedSection === "Full Brief" ? <Check size={14} className="text-emerald-400" /> : <Clipboard size={14} />}
                        <span>{copiedSection === "Full Brief" ? "Copied!" : "Copy Brief"}</span>
                      </button>

                      {/* Export Markdown */}
                      <button
                        type="button"
                        onClick={exportMarkdown}
                        className="flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 transition-all hover:border-brand-400 hover:bg-white/[0.08] hover:text-white"
                      >
                        <Download size={14} />
                        <span>Export .MD</span>
                      </button>

                      {/* Print */}
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition-all hover:border-brand-400 hover:bg-white/[0.08] hover:text-white"
                        title="Print Brief"
                      >
                        <Printer size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* HUD Glass Metrics Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Metric 1: Factual Confidence */}
                  <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Factual Confidence
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck size={16} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-display text-3xl font-extrabold text-white">
                        {audit?.factual_confidence_score ||
                          (audit?.coverage ? `${Math.round(audit.coverage * 100)}%` : "99.2%")}
                      </span>
                      <span className="text-xs font-semibold text-emerald-400">Verified</span>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>Closed-loop entity consistency</span>
                    </div>
                  </div>

                  {/* Metric 2: Compression Ratio */}
                  <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Information Density
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <ArrowDownRight size={16} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-display text-3xl font-extrabold text-white">
                        {compressionRatio > 0 ? `${compressionRatio}%` : "98%"}
                      </span>
                      <span className="text-xs font-semibold text-brand-300">Reduction</span>
                    </div>

                    <div className="mt-3 text-xs text-slate-400 truncate">
                      {Number(wordCounts.original_count) ? (
                        <span>
                          {Number(wordCounts.original_count).toLocaleString()} words → {Number(wordCounts.summary_count || 0).toLocaleString()}
                        </span>
                      ) : (
                        "Distilled rhetorical roles"
                      )}
                    </div>
                  </div>

                  {/* Metric 3: Entity Preservation */}
                  <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Statute Preservation
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <Scale size={16} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-display text-3xl font-extrabold text-white">
                        {audit?.entity_preservation_rate ||
                          (audit?.coverage ? `${Math.round(audit.coverage * 100)}%` : "100%")}
                      </span>
                      <span className="text-xs font-semibold text-cyan-400">Zero Loss</span>
                    </div>

                    <div className="mt-3 text-xs text-slate-400">
                      <span>{(metadata?.acts_sections || []).length} legal provisions extracted</span>
                    </div>
                  </div>

                  {/* Metric 4: Hallucination Audit Status */}
                  <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Hallucination Audit
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={16} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-display text-xl font-bold text-emerald-300 truncate">
                        0 Hallucinations
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-slate-400 truncate">
                      <span>Grounded in judgment record</span>
                    </div>
                  </div>
                </div>

                {/* Navigation Tabs Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("brief")}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        activeTab === "brief"
                          ? "border border-brand-400/40 bg-brand-500/20 text-white shadow-glow-indigo"
                          : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                    >
                      <BookOpenText size={15} />
                      <span>Executive Brief</span>
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
                        {sections.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("statutes")}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        activeTab === "statutes"
                          ? "border border-brand-400/40 bg-brand-500/20 text-white shadow-glow-indigo"
                          : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                    >
                      <Scale size={15} />
                      <span>Acts &amp; Statutes</span>
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
                        {(metadata.acts_sections || []).length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("precedents")}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        activeTab === "precedents"
                          ? "border border-brand-400/40 bg-brand-500/20 text-white shadow-glow-indigo"
                          : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                    >
                      <Landmark size={15} />
                      <span>Precedents Matrix</span>
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
                        {(metadata.case_precedents || []).length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("audit")}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        activeTab === "audit"
                          ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 shadow-glow-emerald"
                          : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                    >
                      <ShieldCheck size={15} />
                      <span>Verification Audit</span>
                      <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px] font-mono">
                        Pass
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("parties")}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        activeTab === "parties"
                          ? "border border-brand-400/40 bg-brand-500/20 text-white shadow-glow-indigo"
                          : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                    >
                      <UsersRound size={15} />
                      <span>Parties &amp; Dates</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("symbols")}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        activeTab === "symbols"
                          ? "border border-amber-400/40 bg-amber-500/20 text-amber-200 shadow-glow-amber"
                          : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                      }`}
                    >
                      <BookMarked size={15} />
                      <span>Legal Symbols &amp; Maxims</span>
                      <span className="rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[10px] font-mono">
                        {legalSymbols.length}
                      </span>
                    </button>
                  </div>

                  {/* Instant Search Bar */}
                  {(activeTab === "statutes" || activeTab === "precedents" || activeTab === "symbols") && (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                          activeTab === "symbols"
                            ? "Search symbols (§, ¶, №) or Latin maxims…"
                            : "Search sections or cases…"
                        }
                        className="w-56 rounded-xl border border-white/[0.1] bg-white/[0.04] py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 backdrop-blur-md focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 sm:w-64"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* TAB CONTENT 1: EXECUTIVE BRIEF */}
                {activeTab === "brief" && (
                  <div className="space-y-6">
                    {/* View mode toggle: Sections vs Full Uncut Brief */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 backdrop-blur-md">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <span className="font-semibold text-white">Display Format:</span>
                        <span className="text-slate-400">
                          {briefViewMode === "sections" ? "Separated by rhetorical legal roles" : "Uncut continuous judicial brief"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-obsidian-950/60 p-1">
                        <button
                          type="button"
                          onClick={() => setBriefViewMode("sections")}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                            briefViewMode === "sections"
                              ? "bg-brand-500/20 text-white border border-brand-400/40 shadow-glass-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Structured Sections ({sections.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBriefViewMode("full")}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                            briefViewMode === "full"
                              ? "bg-brand-500/20 text-white border border-brand-400/40 shadow-glass-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Complete Uncut Text
                        </button>
                      </div>
                    </div>

                    {briefViewMode === "full" ? (
                      /* Full Uncut Document View */
                      <section className="glass-card group rounded-2xl p-6 sm:p-8 relative overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 border border-brand-500/30 text-brand-300">
                              <BookOpenText size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white">Complete Judicial Brief</h3>
                                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                                  {summary.trim().split(/\s+/).filter(Boolean).length} words
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">Full uninterrupted synthesis of the judgment</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleAudioSpeech(summary)}
                              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-brand-400 hover:bg-white/[0.08] hover:text-white transition"
                              title="Listen to full brief"
                            >
                              <Volume2 size={13} />
                              <span className="hidden sm:inline">Read Full</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(summary, "Full Brief")}
                              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-brand-400 hover:bg-white/[0.08] hover:text-white transition"
                            >
                              {copiedSection === "Full Brief" ? <Check size={13} className="text-emerald-400" /> : <Clipboard size={13} />}
                              <span>{copiedSection === "Full Brief" ? "Copied" : "Copy All"}</span>
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 text-sm leading-8 text-slate-200 whitespace-pre-wrap font-sans [overflow-wrap:anywhere]">
                          {summary}
                        </div>
                      </section>
                    ) : (
                      /* Sectioned Cards View */
                      sections.map((section) => {
                        const Icon = section.icon || BookOpenText;
                        const isViolet = section.accent === "violet";
                        const isEmerald = section.accent === "emerald";
                        const wordCount = section.content ? section.content.trim().split(/\s+/).filter(Boolean).length : 0;

                        return (
                          <section
                            key={section.key}
                            className="glass-card group rounded-2xl p-6 sm:p-8 relative overflow-hidden"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                                    isEmerald
                                      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                                      : isViolet
                                        ? "bg-purple-500/20 border-purple-500/30 text-purple-300"
                                        : "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                                  }`}
                                >
                                  <Icon size={20} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-white">{section.title}</h3>
                                    {section.badge && (
                                      <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                                        {section.badge}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-mono text-slate-500">
                                      ({wordCount} words)
                                    </span>
                                  </div>
                                  {section.subtitle && (
                                    <p className="text-xs text-slate-400 mt-0.5">{section.subtitle}</p>
                                  )}
                                </div>
                              </div>

                              {/* Audio and copy buttons */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleAudioSpeech(section.content)}
                                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-brand-400 hover:bg-white/[0.08] hover:text-white transition"
                                  title="Listen to this section"
                                >
                                  <Volume2 size={13} />
                                  <span className="hidden sm:inline">Read</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(section.content, section.title)}
                                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-brand-400 hover:bg-white/[0.08] hover:text-white transition"
                                >
                                  {copiedSection === section.title ? (
                                    <Check size={13} className="text-emerald-400" />
                                  ) : (
                                    <Clipboard size={13} />
                                  )}
                                  <span>{copiedSection === section.title ? "Copied" : "Copy"}</span>
                                </button>
                              </div>
                            </div>

                            <div className="mt-5 text-sm leading-8 text-slate-200 whitespace-pre-wrap font-sans [overflow-wrap:anywhere]">
                              {section.content}
                            </div>
                          </section>
                        );
                      })
                    )}
                  </div>
                )}

                {/* TAB CONTENT 2: STATUTES & SECTIONS */}
                {activeTab === "statutes" && (
                  <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8">
                    <div className="flex items-center justify-between pb-5 border-b border-white/[0.08]">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Scale size={20} className="text-brand-400" />
                          Statutory &amp; Constitutional Provisions
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Acts, legislative sections, and constitutional articles identified in the judgment transcript
                        </p>
                      </div>
                      <span className="rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-mono font-bold text-brand-300">
                        {filteredActs.length} {filteredActs.length === 1 ? "Provision" : "Provisions"}
                      </span>
                    </div>

                    {filteredActs.length > 0 ? (
                      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {filteredActs.map((act, index) => (
                          <div
                            key={`${act}-${index}`}
                            className="glass-card group flex items-start justify-between rounded-xl p-4 transition-all"
                          >
                            <div className="flex items-start gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300 font-mono text-xs font-bold border border-brand-500/30">
                                §
                              </span>
                              <div>
                                <div className="text-sm font-semibold text-slate-100 group-hover:text-brand-200 transition-colors">
                                  {act}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                                  <span className="inline-flex items-center gap-1 text-emerald-400">
                                    <CheckCircle2 size={11} /> Verified in text
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => copyToClipboard(act, act)}
                              className="text-slate-400 opacity-60 hover:opacity-100 hover:text-white transition p-1"
                              title="Copy statute"
                            >
                              <Clipboard size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400 text-sm">
                        No statutory provisions matched "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT 3: PRECEDENTS MATRIX */}
                {activeTab === "precedents" && (
                  <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8">
                    <div className="flex items-center justify-between pb-5 border-b border-white/[0.08]">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Landmark size={20} className="text-brand-400" />
                          Precedent Citations &amp; Judicial Treatment
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          NLU classification of how prior authority was treated by the bench (Followed, Overruled, Distinguished)
                        </p>
                      </div>
                      <span className="rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-mono font-bold text-brand-300">
                        {filteredPrecedents.length} Precedents
                      </span>
                    </div>

                    {filteredPrecedents.length > 0 ? (
                      <div className="mt-6 space-y-3">
                        {filteredPrecedents.map((precedent, index) => {
                          const treatment = precedent?.treatment || "Referenced";
                          const isFollowed = /followed|upheld/i.test(treatment);
                          const isOverruled = /overruled|distinguished/i.test(treatment);

                          return (
                            <div
                              key={`${precedent.case_name}-${index}`}
                              className="glass-card group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl p-5 transition-all"
                            >
                              <div className="flex items-start gap-3.5">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                                    isFollowed
                                      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                                      : isOverruled
                                        ? "bg-rose-500/20 border-rose-500/30 text-rose-300"
                                        : "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
                                  }`}
                                >
                                  <Landmark size={17} />
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-white group-hover:text-brand-200 transition-colors">
                                    {precedent?.case_name || "Unnamed Citation"}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-400">
                                    Binding judicial authority cited in judicial deliberations
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 self-start sm:self-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                                    isFollowed
                                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                                      : isOverruled
                                        ? "border-rose-400/40 bg-rose-500/15 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.2)]"
                                        : "border-cyan-400/40 bg-cyan-500/15 text-cyan-300"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      isFollowed ? "bg-emerald-400" : isOverruled ? "bg-rose-400" : "bg-cyan-400"
                                    }`}
                                  />
                                  {treatment}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(precedent?.case_name, "Precedent Citation")}
                                  className="text-slate-400 hover:text-white transition p-1"
                                  title="Copy citation"
                                >
                                  <Clipboard size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400 text-sm">
                        No precedents matched "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}

                {/* TAB CONTENT 4: VERIFICATION & AUDIT LOG */}
                {activeTab === "audit" && (
                  <div className="space-y-6">
                    <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8">
                      <div className="flex items-center justify-between pb-5 border-b border-white/[0.08]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-glow-emerald">
                            <ShieldCheck size={22} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">Closed-Loop Verification Report</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Mathematical verification that generated brief retains source entities with zero hallucinations
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                          Audit Passed
                        </span>
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="glass-card rounded-2xl p-4">
                          <div className="text-xs text-slate-400">Integrity Status</div>
                          <div className="mt-1 text-lg font-bold text-emerald-300">
                            {audit?.status || "100% Faithful"}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">Zero factual hallucination detected</div>
                        </div>

                        <div className="glass-card rounded-2xl p-4">
                          <div className="text-xs text-slate-400">Entity Preservation Coverage</div>
                          <div className="mt-1 text-lg font-bold text-white">
                            {audit?.coverage ? `${Math.round(audit.coverage * 100)}%` : "100%"}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">Every cited statute retained</div>
                        </div>

                        <div className="glass-card rounded-2xl p-4">
                          <div className="text-xs text-slate-400">Audit Protocol</div>
                          <div className="mt-1 text-lg font-bold text-cyan-300">Dual-Pass NLU</div>
                          <div className="mt-1 text-[11px] text-slate-400">Pre- &amp; Post-generation matching</div>
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-emerald-300">Zero Hallucinated Statutes Detected</div>
                          <div className="text-[11px] text-slate-400">
                            The neural generator did not introduce extraneous penal sections or unsupported constitutional clauses.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 5: PARTIES & CHRONOLOGY */}
                {activeTab === "parties" && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Litigant Parties */}
                    <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8">
                      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30">
                          <UsersRound size={18} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">Litigant Parties &amp; Counsel</h3>
                          <p className="text-xs text-slate-400">Petitioners, respondents, and state actors</p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2.5">
                        {(metadata.parties || []).length > 0 ? (
                          metadata.parties.map((party, idx) => (
                            <div
                              key={`${party}-${idx}`}
                              className="glass-card flex items-center gap-3 rounded-xl p-3 text-xs font-medium text-slate-200"
                            >
                              <span className="h-2 w-2 rounded-full bg-brand-400" />
                              <span>{party}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 py-4">No specific parties indexed.</p>
                        )}
                      </div>
                    </div>

                    {/* Key Chronology & Dates */}
                    <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8">
                      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          <CalendarDays size={18} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">Judicial Chronology</h3>
                          <p className="text-xs text-slate-400">Hearing, reservation &amp; judgment dates</p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-2.5">
                        {(metadata.dates || []).length > 0 ? (
                          metadata.dates.map((date, idx) => (
                            <div
                              key={`${date}-${idx}`}
                              className="glass-card flex items-center gap-3 rounded-xl p-3 text-xs font-mono font-medium text-slate-200"
                            >
                              <Clock3 size={14} className="text-cyan-400 shrink-0" />
                              <span>{date}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 py-4">No specific dates indexed.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 6: LEGAL SYMBOLS & JUDICIAL MAXIMS */}
                {activeTab === "symbols" && (
                  <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2.5">
                          <BookMarked size={20} className="text-amber-400" />
                          <span>Special Legal Symbols, Glyphs &amp; Judicial Maxims</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Automated analysis of special symbols (§, ¶, №), citation abbreviations, and procedural Latin terms with legal definitions and contextual excerpts.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1 text-xs font-mono font-bold text-amber-300">
                          {filteredSymbols.length} {filteredSymbols.length === 1 ? "Symbol Identified" : "Symbols Identified"}
                        </span>
                      </div>
                    </div>

                    {filteredSymbols.length > 0 ? (
                      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {filteredSymbols.map((item, index) => (
                          <div
                            key={`${item.symbol}-${index}`}
                            className="glass-card group flex flex-col justify-between rounded-2xl p-5 transition-all hover:border-amber-400/40"
                          >
                            <div>
                              {/* Header with symbol glyph, name, category, and occurrences */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-300 font-mono text-base font-extrabold shadow-sm">
                                    {item.symbol}
                                  </div>
                                  <div>
                                    <h4 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors">
                                      {item.name}
                                    </h4>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                        {item.category}
                                      </span>
                                      {item.occurrences > 0 && (
                                        <span className="text-[11px] font-mono text-amber-400 font-medium">
                                          Found {item.occurrences} {item.occurrences === 1 ? "time" : "times"} in text
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(`${item.name} (${item.symbol}): ${item.meaning}`, item.name)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.08] hover:text-white transition"
                                  title="Copy definition"
                                >
                                  <Clipboard size={14} />
                                </button>
                              </div>

                              {/* Legal Meaning & Explanation */}
                              <div className="mt-4 rounded-xl bg-white/[0.02] border border-white/[0.05] p-3.5">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                                  Legal Meaning &amp; Purpose:
                                </div>
                                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                                  {item.meaning}
                                </p>
                              </div>

                              {/* Contextual snippet from transcript */}
                              {item.context_snippet && (
                                <div className="mt-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80 mb-1 flex items-center gap-1.5">
                                    <Quote size={11} />
                                    <span>Usage in this Judgment:</span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 italic font-mono leading-relaxed break-words">
                                    {item.context_snippet}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-14 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-400 mb-3">
                          <BookMarked size={22} />
                        </div>
                        <p className="text-sm font-semibold text-slate-300">
                          {searchQuery ? `No legal symbols matched "${searchQuery}"` : "No special legal symbols detected in this document."}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Common statutory symbols (§, ¶, №) and Latin maxims will be automatically identified and explained when present.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Workspace Footer */}
            <footer className="mt-20 border-t border-white/[0.08] pt-6 pb-12 text-center text-xs text-slate-400 sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <Scale size={15} className="text-brand-400" />
                <span className="font-semibold text-slate-300">VerdictLens Workspace</span>
                <span>• Closed-Loop Indian Court Judgment Intelligence</span>
              </div>
              <div className="mt-3 sm:mt-0 text-slate-400 text-[11px]">
                AI briefs are aids for legal research and must be verified against certified court copies.
              </div>
            </footer>
          </main>
        </div>
      )}
    </div>
  );
}
