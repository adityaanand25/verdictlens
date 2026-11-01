import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Cpu,
  FileCheck2,
  FileText,
  Gavel,
  Landmark,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
  Volume2,
  Zap,
} from "lucide-react";

export default function IntroPage({ onExplore, onSelectSampleCase, sampleCases }) {
  return (
    <div className="relative min-h-screen text-slate-100">
      {/* Top Navigation for Intro Page */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-obsidian-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 p-[1px] shadow-glow-indigo">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-obsidian-950/90">
                <Scale size={22} className="text-brand-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold tracking-tight text-white">VerdictLens</span>
                <span className="rounded-full border border-brand-400/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                  Legal AI
                </span>
              </div>
              <span className="block text-[10px] font-medium tracking-[0.18em] text-slate-400">
                INDIAN JUDGMENT INTELLIGENCE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="#features"
              className="hidden text-xs font-semibold text-slate-300 hover:text-white transition md:inline-block"
            >
              Core Capabilities
            </a>
            <a
              href="#pipeline"
              className="hidden text-xs font-semibold text-slate-300 hover:text-white transition md:inline-block"
            >
              AI Architecture
            </a>
            <a
              href="#landmarks"
              className="hidden text-xs font-semibold text-slate-300 hover:text-white transition md:inline-block"
            >
              Landmarks
            </a>

            {/* Prominent Explore Button in Header */}
            <button
              type="button"
              onClick={() => onExplore()}
              className="group relative flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-brand-600/30 transition-all hover:shadow-glow-indigo hover:brightness-110"
            >
              <span>Explore Platform</span>
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28 text-center">
        {/* Release / Innovation Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-300 backdrop-blur-md mb-8 shadow-glow-indigo animate-pulse-subtle">
          <Sparkles size={14} className="text-brand-400" />
          <span>Next-Gen Legal Language Processing for Indian Courts</span>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden sm:inline font-mono text-[11px] text-brand-200">v2.0 Closed-Loop</span>
        </div>

        {/* Main Headline */}
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl max-w-5xl mx-auto leading-[1.12]">
          Deconstruct Indian Court Judgments With{" "}
          <span className="text-shimmer">Absolute Mathematical Integrity</span>
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mt-7 max-w-3xl text-base text-slate-300 leading-relaxed sm:text-xl">
          VerdictLens turns 200+ page Indian judicial transcripts into concise, structured case briefs—extracting
          <span className="text-white font-semibold"> Facts of the Case</span>, 
          <span className="text-white font-semibold"> Ratio Decidendi</span>, and 
          <span className="text-white font-semibold"> Operative Decrees</span> with an auditable guarantee of 
          <span className="text-emerald-400 font-semibold"> zero hallucinated statutes</span>.
        </p>

        {/* Core Call to Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => onExplore()}
            className="group relative flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-brand-600/40 transition-all hover:-translate-y-1 hover:shadow-glow-indigo hover:brightness-110 active:translate-y-0"
          >
            <span>Explore Platform &amp; Upload Document</span>
            <ArrowRight size={19} className="transition-transform group-hover:translate-x-1.5" />
          </button>

          {sampleCases?.[0] && (
            <button
              type="button"
              onClick={() => onSelectSampleCase(sampleCases[0])}
              className="flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl border border-white/[0.14] bg-white/[0.05] px-6 py-4 text-base font-semibold text-slate-200 backdrop-blur-md transition-all hover:border-brand-400 hover:bg-white/[0.1] hover:text-white"
            >
              <Landmark size={18} className="text-brand-400" />
              <span>Try Landmark Case (Puttaswamy)</span>
            </button>
          )}
        </div>

        {/* Key trust indicators */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>Closed-Loop Verification Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-cyan-400" />
            <span>0% Hallucinated Statutes Detected</span>
          </div>
          <div className="flex items-center gap-2">
            <LockKeyhole size={16} className="text-brand-400" />
            <span>100% Client-Side / Local Processing</span>
          </div>
        </div>

        {/* Interactive Showcase Preview Teaser */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="glass-panel-elevated relative overflow-hidden rounded-3xl p-6 sm:p-8 text-left shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-500 via-cyan-400 to-purple-500" />

            {/* Mock Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="text-xs font-mono font-bold text-slate-200">
                  PREVIEW: K.S. PUTTASWAMY V. UNION OF INDIA (2017)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-500/15 border border-brand-400/30 px-2.5 py-0.5 text-[11px] font-mono text-brand-300">
                  9-Judge Bench
                </span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-mono text-emerald-300">
                  99.2% Factual Confidence
                </span>
              </div>
            </div>

            {/* Mock Content Snippets */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 text-brand-300 text-xs font-bold mb-2">
                  <BookOpenText size={15} />
                  <span>FACTS OF THE CASE</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
                  Challenged the mandatory Aadhaar biometric enrollment scheme under fundamental rights provisions. 
                  Referred to a 9-judge bench to clarify whether privacy is constitutionally protected.
                </p>
              </div>

              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 text-purple-300 text-xs font-bold mb-2">
                  <Sparkles size={15} />
                  <span>COURT RATIONALE</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
                  Privacy is an intrinsic element of life and liberty under Article 21. Dignity cannot exist without 
                  informational self-determination and bodily autonomy. Established a 3-fold proportionality test.
                </p>
              </div>

              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold mb-2">
                  <Gavel size={15} />
                  <span>FINAL ORDER &amp; HELD</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
                  Unanimously affirmed privacy as a Fundamental Right under Part III. M.P. Sharma (1954) and Kharak Singh (1962) 
                  stand expressly overruled to the extent of inconsistency.
                </p>
              </div>
            </div>

            {/* Launch CTA Strip inside preview */}
            <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                Experience full entity matrix, precedent tracking, audio readout &amp; export in the main app.
              </div>
              <button
                type="button"
                onClick={() => onExplore()}
                className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2 text-xs font-bold text-white hover:bg-brand-500 hover:shadow-glow-indigo transition-all"
              >
                <span>Launch Interactive Workspace</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars Section */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 border-t border-white/[0.08]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-300 uppercase tracking-wider mb-3">
            <Zap size={13} />
            Groundbreaking Capabilities
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Why Indian Courts &amp; Legal Researchers Choose VerdictLens
          </h2>
          <p className="mt-3 text-sm text-slate-400 sm:text-base">
            Engineered from the ground up for the nuances of Indian constitutional, criminal, and corporate jurisprudence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Feature 1 */}
          <div className="glass-card group rounded-3xl p-6 relative overflow-hidden transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300 border border-brand-500/30 mb-5 group-hover:scale-110 transition-transform">
              <BookOpenText size={24} />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors">
              Rhetorical Role Extraction
            </h3>
            <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
              Segment judgments into natural legal pillars: Facts, Issues Framed, Court Rationale (Ratio Decidendi),
              and Final Disposition.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-card group rounded-3xl p-6 relative overflow-hidden transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mb-5 group-hover:scale-110 transition-transform">
              <Landmark size={24} />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
              Precedent Treatment Radar
            </h3>
            <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
              Accurately categorizes how past landmark citations were treated by the bench—identifying whether they were
              Followed, Overruled, or Distinguished.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-card group rounded-3xl p-6 relative overflow-hidden transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-5 group-hover:scale-110 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
              Zero-Hallucination Audit
            </h3>
            <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
              Every extracted section, article, and legal citation is verified against the source text with closed-loop
              cross-entity validation.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="glass-card group rounded-3xl p-6 relative overflow-hidden transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-5 group-hover:scale-110 transition-transform">
              <Volume2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
              Speech Readout &amp; Export
            </h3>
            <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
              Listen to the operative decree on the go with built-in voice narration, or export clean Markdown briefs
              ready for case filings.
            </p>
          </div>
        </div>
      </section>

      {/* AI Pipeline Architecture Section */}
      <section id="pipeline" className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 border-t border-white/[0.08]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-3">
            <Cpu size={13} />
            Under The Hood
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            4-Stage Closed-Loop AI Pipeline
          </h2>
          <p className="mt-3 text-sm text-slate-400 sm:text-base">
            How raw judicial transcripts are transformed into bulletproof legal briefs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-card rounded-2xl p-6 relative">
            <div className="text-xs font-mono font-bold text-brand-400 mb-2">STAGE 01</div>
            <h4 className="text-base font-bold text-white mb-2">PDF Deconstruction</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Strips OCR artifacts, parses cause titles, identifies judges, benches, and extracts raw legal text streams.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 relative">
            <div className="text-xs font-mono font-bold text-cyan-400 mb-2">STAGE 02</div>
            <h4 className="text-base font-bold text-white mb-2">NLU Entity Extraction</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Identifies Indian Penal Code sections, Constitutional Articles, statute names, and cited precedent cases.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 relative">
            <div className="text-xs font-mono font-bold text-purple-400 mb-2">STAGE 03</div>
            <h4 className="text-base font-bold text-white mb-2">Rhetorical Role LED</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Longformer Encoder-Decoder distills 4096+ tokens into Facts, Court Rationale, and Operative Decree.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 relative">
            <div className="text-xs font-mono font-bold text-emerald-400 mb-2">STAGE 04</div>
            <h4 className="text-base font-bold text-white mb-2">Integrity Audit</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Mathematical post-audit validates 100% statute preservation and flags any hallucinated sections.
            </p>
          </div>
        </div>
      </section>

      {/* Landmark Cases Carousel / Showcase */}
      <section id="landmarks" className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 border-t border-white/[0.08]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300 uppercase tracking-wider mb-3">
            <Landmark size={13} />
            Verified Case Studies
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Explore Built-in Supreme Court Landmarks
          </h2>
          <p className="mt-3 text-sm text-slate-400 sm:text-base">
            Click any case to launch the interactive workspace and inspect extracted entities and precedents.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sampleCases.map((sc) => (
            <div
              key={sc.id}
              className="glass-card group flex flex-col justify-between rounded-3xl p-6 transition-all hover:border-brand-400"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-cyan-300 mb-3">
                  <span>{sc.citation}</span>
                  <span className="text-slate-400">{sc.date.split(" ")[2]}</span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors">
                  {sc.title}
                </h3>
                <p className="mt-3 text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {sc.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">{sc.category.split("/")[0]}</span>
                <button
                  type="button"
                  onClick={() => onSelectSampleCase(sc)}
                  className="flex items-center gap-1.5 text-xs font-bold text-brand-300 group-hover:text-white transition-colors"
                >
                  <span>Explore Case</span>
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-20 sm:px-8 text-center">
        <div className="glass-panel-elevated relative overflow-hidden rounded-3xl p-8 sm:p-14">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-400 to-transparent" />
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
            Ready to Deconstruct Your Next Judgment?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300 leading-relaxed sm:text-base">
            Upload your court transcript PDF or test with our landmark database. Experience verified closed-loop legal analysis.
          </p>

          <button
            type="button"
            onClick={() => onExplore()}
            className="group mt-8 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-brand-600/40 transition-all hover:-translate-y-1 hover:shadow-glow-indigo hover:brightness-110"
          >
            <span>Explore VerdictLens Workspace</span>
            <ArrowRight size={19} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* Intro Footer */}
      <footer className="mt-12 border-t border-white/[0.08] pt-8 pb-12 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-brand-400" />
            <span className="font-semibold text-slate-200">VerdictLens</span>
            <span>• Next-Gen Indian Judgment Intelligence</span>
          </div>
          <div>
            Built for legal practitioners, researchers, and judicial scholars.
          </div>
        </div>
      </footer>
    </div>
  );
}

