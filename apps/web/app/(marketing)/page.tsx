import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Runtime - Turn your Python script into a live app',
  description:
    'Built something with Cursor or ChatGPT? Make it live in 60 seconds. No servers, no Docker, no devops.',
  openGraph: {
    title: 'Runtime - You built it with AI. We make it live.',
    description:
      'Turn any Python script into a shareable app with a link. Zero infrastructure.',
    type: 'website',
  },
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <style dangerouslySetInnerHTML={{ __html: terminalAnimationCSS }} />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-[var(--text-primary)] text-[15px]">Runtime</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Sign in</Link>
            <Link href="/signup" className="px-5 py-2 text-[13px] font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[var(--accent)]/[0.04] rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-[1100px] mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[var(--accent)]/[0.08] border border-[var(--accent)]/15 rounded-full mb-8">
              <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full" />
              <span className="text-[12px] font-medium text-[var(--accent)]">Open source</span>
            </div>
            <h1 className="text-[36px] sm:text-[48px] md:text-[64px] font-bold text-[var(--text-primary)] leading-[1.05] tracking-tight mb-6">
              You built it with AI.
              <br />
              <span className="text-[var(--accent)]">We make it live.</span>
            </h1>
            <p className="text-[17px] md:text-[19px] text-[var(--text-secondary)] leading-relaxed max-w-[520px] mx-auto mb-10">
              Turn any Python script into a live app with a shareable link. No servers, no Docker, no devops. Just your code.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/signup" className="w-full sm:w-auto px-8 py-3.5 text-[15px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl transition-all hover:shadow-[0_0_24px_rgba(16,185,129,0.25)] text-center">Deploy for free</Link>
              <a href="https://github.com/federicodeponte/execution-layer" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-8 py-3.5 text-[15px] font-semibold bg-white/[0.04] border border-white/[0.08] text-[var(--text-primary)] rounded-xl hover:bg-white/[0.07] hover:border-white/[0.12] transition-all text-center">View on GitHub</a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-[13px] text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1.5 whitespace-nowrap"><svg className="w-3.5 h-3.5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>MIT Licensed</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap"><svg className="w-3.5 h-3.5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Free tier forever</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap"><svg className="w-3.5 h-3.5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>No credit card</span>
            </div>
          </div>

          {/* Animated terminal */}
          <div className="max-w-[680px] mx-auto">
            <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0e] overflow-hidden shadow-2xl shadow-black/40">
              <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[11px] text-[var(--text-tertiary)] ml-2 font-mono">terminal</span>
              </div>
              <div className="p-5 font-mono text-[13px] leading-[1.8]">
                <div className="term-line term-line-1 text-[var(--text-tertiary)]"><span className="text-[var(--accent)]">$</span> runtime deploy invoice_generator.py</div>
                <div className="term-line term-line-2 text-[var(--text-tertiary)] mt-1">Uploading... <span className="text-[var(--text-secondary)]">done</span></div>
                <div className="term-line term-line-3 text-[var(--text-tertiary)]">Building... <span className="text-[var(--text-secondary)]">done</span></div>
                <div className="term-line term-line-4 text-[var(--text-tertiary)]">Starting... <span className="text-[var(--accent)]">live</span></div>
                <div className="term-line term-line-5 mt-3 pt-3 border-t border-white/[0.06]">
                  <span className="text-[var(--text-tertiary)]">Your app is live at</span><br />
                  <span className="text-[var(--accent)]">https://runtime.dev/s/ab3f9k2</span>
                </div>
                <div className="term-line term-line-6 mt-3 text-[var(--text-tertiary)]">
                  <span className="text-[var(--accent)]">$</span>{' '}
                  <span className="inline-block w-2 h-4 bg-[var(--text-secondary)] animate-pulse align-middle" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product mockup */}
      <section className="py-24 px-6 bg-white/[0.015]">
        <div className="max-w-[960px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[32px] font-bold text-[var(--text-primary)] mb-3">Your code gets a UI. Automatically.</h2>
            <p className="text-[var(--text-secondary)] text-[16px]">Upload a Python script. We generate a web interface. Anyone can use it.</p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0c0c0e] overflow-hidden shadow-2xl shadow-black/40">
            {/* App header */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.03] border-b border-white/[0.06]">
              <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-[var(--text-tertiary)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
              </div>
              <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
              <div>
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">Invoice Generator</span>
                <span className="text-[12px] text-[var(--text-tertiary)] ml-2">/generate</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-[var(--accent)]/[0.08] border border-[var(--accent)]/15 rounded-md">
                <svg className="w-3.5 h-3.5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.497a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.69" /></svg>
                <span className="text-[11px] font-medium text-[var(--accent)]">Share</span>
              </div>
            </div>

            {/* Split panel */}
            <div className="grid md:grid-cols-2 divide-x divide-white/[0.06]">
              <div className="p-6">
                <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-5">Inputs</div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Client name</label>
                    <div className="px-3 py-2.5 bg-[var(--bg-tertiary)] border border-white/[0.06] rounded-lg text-[13px] text-[var(--text-primary)]">Acme Corp</div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Amount</label>
                    <div className="px-3 py-2.5 bg-[var(--bg-tertiary)] border border-white/[0.06] rounded-lg text-[13px] text-[var(--text-primary)]">2,500.00</div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
                    <div className="px-3 py-2.5 bg-[var(--bg-tertiary)] border border-white/[0.06] rounded-lg text-[13px] text-[var(--text-primary)] min-h-[60px]">Website redesign - Phase 2</div>
                  </div>
                  <div className="pt-2">
                    <div className="w-full py-3 bg-[var(--accent)] rounded-lg text-white text-[14px] font-semibold text-center flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
                      Run
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-white/[0.01]">
                <div className="flex items-center justify-between mb-5">
                  <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Output</div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--accent)]/[0.1] rounded text-[11px] font-medium text-[var(--accent)]">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      Success
                    </div>
                    <span className="text-[11px] text-[var(--text-tertiary)]">247ms</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3"><span className="text-[12px] text-[var(--text-tertiary)] w-20 flex-shrink-0 pt-0.5">Invoice ID</span><span className="text-[13px] text-[var(--accent)] font-mono">INV-2024-0847</span></div>
                  <div className="flex items-start gap-3"><span className="text-[12px] text-[var(--text-tertiary)] w-20 flex-shrink-0 pt-0.5">Client</span><span className="text-[13px] text-[var(--text-primary)]">Acme Corp</span></div>
                  <div className="flex items-start gap-3"><span className="text-[12px] text-[var(--text-tertiary)] w-20 flex-shrink-0 pt-0.5">Total</span><span className="text-[13px] text-[var(--text-primary)] font-semibold">$2,500.00</span></div>
                  <div className="flex items-start gap-3"><span className="text-[12px] text-[var(--text-tertiary)] w-20 flex-shrink-0 pt-0.5">Status</span><span className="px-2 py-0.5 bg-[var(--accent)]/[0.1] rounded text-[11px] font-medium text-[var(--accent)]">Sent</span></div>
                  <div className="flex items-start gap-3"><span className="text-[12px] text-[var(--text-tertiary)] w-20 flex-shrink-0 pt-0.5">PDF</span><span className="text-[13px] text-[var(--accent)] underline underline-offset-2 decoration-[var(--accent)]/30">invoice-acme-0847.pdf</span></div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-[13px] text-[var(--text-tertiary)] mt-4">This is what your deployed app looks like. The form, the output, the share link: all generated from a Python script.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[32px] font-bold text-[var(--text-primary)] mb-3">Three steps. Sixty seconds.</h2>
            <p className="text-[var(--text-secondary)] text-[16px]">From code on your laptop to a live app anyone can use.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-0">
            <div className="relative p-6">
              <StepCard number="1" title="Upload your code" description="Paste a Python script, drop a .zip file, or connect a GitHub repo. We handle the rest." icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>} />
              <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 rounded-full bg-[var(--bg-primary)] border border-white/[0.08] items-center justify-center">
                <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </div>
            </div>
            <div className="relative p-6">
              <StepCard number="2" title="We build your app" description="Your code gets a live URL and an auto-generated interface. No frontend needed." icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.385 3.17M6.09 6.09l5.33 3.168m0 0l5.33-3.168M11.42 9.26v6.91m5.385 3.17L21.75 16.5V7.5l-4.945-2.83M6.09 6.09L1.145 3.26v9l4.945 2.83" /></svg>} />
              <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 rounded-full bg-[var(--bg-primary)] border border-white/[0.08] items-center justify-center">
                <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </div>
            </div>
            <div className="p-6">
              <StepCard number="3" title="Share the link" description="Anyone can run your app from their browser. Share it with your team, clients, or the world." icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>} />
            </div>
          </div>
        </div>
      </section>

      {/* Built for */}
      <section className="py-24 px-6 bg-white/[0.015]">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[32px] font-bold text-[var(--text-primary)] mb-3">Built for the new wave of AI builders</h2>
            <p className="text-[var(--text-secondary)] text-[16px]">You don&apos;t need to be a devops engineer to ship software.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <AudienceCard icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" /></svg>} title="Cursor users" description="You wrote a Python script with Cursor. Now what? Upload it here and get a live app with a URL in under a minute." />
            <AudienceCard icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>} title="n8n & Make users" description="Need custom logic your automation tool can't handle? Deploy a Python function and call it as a webhook from your flow." />
            <AudienceCard icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>} title="ChatGPT users" description="ChatGPT gave you working code. Runtime turns it into a real app anyone can use, with a UI and a shareable link." />
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-24 px-6">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[32px] font-bold text-[var(--text-primary)] mb-3">What people are building</h2>
            <p className="text-[var(--text-secondary)] text-[16px]">If you can write it in Python (or get AI to write it), you can deploy it here.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <UseCaseCard title="PDF to text converter" description="Upload a PDF, get clean extracted text. Built with PyMuPDF in 20 lines." tag="Document" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>} />
            <UseCaseCard title="AI chatbot endpoint" description="Wrap any LLM API in a simple endpoint. Connect it to n8n or Make." tag="AI" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>} />
            <UseCaseCard title="Data scraper" description="Give it a URL, get structured data back. Perfect for automations." tag="Scraping" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>} />
            <UseCaseCard title="Image generator" description="Text to image with GPU acceleration. Share it as a tool for your team." tag="GPU" icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 18V6a2.25 2.25 0 012.25-2.25h15A2.25 2.25 0 0121.75 6v12A2.25 2.25 0 0119.5 20.25H4.5A2.25 2.25 0 012.25 18z" /></svg>} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-white/[0.015]">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[32px] font-bold text-[var(--text-primary)] mb-3">Everything you need, nothing you don&apos;t</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-8">
            <div className="flex gap-4">
              <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
              <div><h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Auto-generated UI</h3><p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">Form inputs, structured output, and a run button. All from your Python type hints.</p></div>
            </div>
            <div className="flex gap-4">
              <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
              <div><h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Encrypted secrets</h3><p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">API keys encrypted with AES-256. Never exposed in share links or logs.</p></div>
            </div>
            <div className="flex gap-4">
              <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" /></svg>
              <div><h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">GPU support</h3><p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">Toggle GPU mode for ML workloads. A10G with 16GB VRAM, on demand.</p></div>
            </div>
            <div className="flex gap-4">
              <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.497a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.69" /></svg>
              <div><h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Share links</h3><p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">Public links for any action. Anyone can run it without signing up.</p></div>
            </div>
            <div className="flex gap-4">
              <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>
              <div><h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Webhook endpoints</h3><p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">Receive data from n8n, Make, or Zapier. Process it with Python, send results back.</p></div>
            </div>
            <div className="flex gap-4">
              <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
              <div><h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Open source</h3><p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">Self-host it, fork it, contribute. MIT licensed. Your code, your infrastructure.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6">
        <div className="max-w-[960px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[32px] font-bold text-[var(--text-primary)] mb-3">Start free. Scale when you need to.</h2>
            <p className="text-[var(--text-secondary)] text-[16px]">No credit card required. Upgrade anytime.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <PricingCard name="Free" price="$0" description="For trying things out" features={['100 runs / month', '3 apps', 'CPU only', 'Community support']} cta="Get started" ctaHref="/signup" highlighted={false} />
            <PricingCard name="Pro" price="$19" period="/mo" description="For builders shipping real projects" features={['2,000 runs / month', '20 apps', 'GPU access (A10G)', 'Unlimited share links', 'Email support']} cta="Start free trial" ctaHref="/signup" highlighted={true} />
            <PricingCard name="Team" price="$49" period="/mo" description="For teams and agencies" features={['10,000 runs / month', 'Unlimited apps', '500 GPU runs', 'Priority support', 'Custom domains (soon)']} cta="Contact us" ctaHref="mailto:fede@scaile.tech" highlighted={false} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/[0.04] via-[var(--accent)]/[0.02] to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[var(--accent)]/[0.03] rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-[600px] mx-auto text-center">
          <h2 className="text-[40px] font-bold text-[var(--text-primary)] mb-5 leading-tight">Your code deserves to be live.</h2>
          <p className="text-[var(--text-secondary)] text-[17px] mb-10 leading-relaxed">Stop sharing screenshots of terminal output. Deploy in 60 seconds and send a link.</p>
          <Link href="/signup" className="inline-flex px-10 py-4 text-[16px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl transition-all hover:shadow-[0_0_32px_rgba(16,185,129,0.3)]">Deploy for free</Link>
          <p className="mt-5 text-[13px] text-[var(--text-tertiary)]">Free forever for small projects. No credit card needed.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/[0.06]">
        <div className="max-w-[900px] mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[var(--accent)] rounded-md flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span className="text-[12px] text-[var(--text-tertiary)]">Runtime</span>
            </div>
            <div className="flex items-center gap-6 text-[12px] text-[var(--text-tertiary)]">
              <a href="https://github.com/federicodeponte/execution-layer" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-secondary)] transition-colors">GitHub</a>
              <Link href="/login" className="hover:text-[var(--text-secondary)] transition-colors">Sign in</Link>
              <Link href="/signup" className="hover:text-[var(--text-secondary)] transition-colors">Get started</Link>
              <a href="mailto:fede@scaile.tech" className="hover:text-[var(--text-secondary)] transition-colors">Contact</a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-white/[0.04] text-[11px] text-[var(--text-tertiary)]">MIT Licensed. Built by humans, deployed by machines.</div>
        </div>
      </footer>
    </div>
  );
}

const terminalAnimationCSS = `
  .term-line { opacity: 0; animation: termReveal 0.3s ease forwards; }
  .term-line-1 { animation-delay: 0.5s; }
  .term-line-2 { animation-delay: 1.2s; }
  .term-line-3 { animation-delay: 1.8s; }
  .term-line-4 { animation-delay: 2.3s; }
  .term-line-5 { animation-delay: 3.0s; }
  .term-line-6 { animation-delay: 3.8s; }
  @keyframes termReveal { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
`;

function StepCard({ number, title, description, icon }: { number: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="group relative p-6 bg-[var(--bg-secondary)] border border-white/[0.06] rounded-xl hover:border-white/[0.1] transition-all">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-[var(--accent)] rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.2)]"><span className="text-[14px] font-bold text-white">{number}</span></div>
        <div className="w-9 h-9 bg-[var(--accent)]/[0.08] rounded-lg flex items-center justify-center text-[var(--accent)]">{icon}</div>
      </div>
      <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function AudienceCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl bg-[var(--bg-secondary)] border border-white/[0.06] hover:border-white/[0.1] transition-all">
      <div className="w-10 h-10 bg-[var(--accent)]/[0.08] rounded-lg flex items-center justify-center text-[var(--accent)] mb-4">{icon}</div>
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function UseCaseCard({ title, description, tag, icon }: { title: string; description: string; tag: string; icon: React.ReactNode }) {
  return (
    <div className="group flex gap-4 p-5 bg-[var(--bg-secondary)] border border-white/[0.06] rounded-xl hover:border-white/[0.1] transition-all">
      <div className="w-10 h-10 bg-[var(--accent)]/[0.08] rounded-lg flex items-center justify-center text-[var(--accent)] flex-shrink-0 group-hover:bg-[var(--accent)]/[0.12] transition-colors">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h3>
          <span className="px-2 py-0.5 bg-[var(--accent)]/[0.08] border border-[var(--accent)]/15 rounded text-[11px] font-medium text-[var(--accent)]">{tag}</span>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
    </div>
  );
}


function PricingCard({ name, price, period, description, features, cta, ctaHref, highlighted }: { name: string; price: string; period?: string; description: string; features: string[]; cta: string; ctaHref: string; highlighted: boolean }) {
  return (
    <div className={`relative p-6 rounded-xl border transition-all ${highlighted ? 'bg-[var(--bg-secondary)] border-[var(--accent)]/40 shadow-[0_0_30px_rgba(16,185,129,0.08)]' : 'bg-[var(--bg-secondary)] border-white/[0.06] hover:border-white/[0.1]'}`}>
      {highlighted && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--accent)] rounded-full text-[11px] font-semibold text-white">Most popular</div>}
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">{name}</h3>
      <p className="text-[12px] text-[var(--text-tertiary)] mb-5">{description}</p>
      <div className="mb-6"><span className="text-[40px] font-bold text-[var(--text-primary)] tracking-tight">{price}</span>{period && <span className="text-[14px] text-[var(--text-tertiary)] ml-0.5">{period}</span>}</div>
      <ul className="space-y-3 mb-8">
        {features.map((f, i) => <li key={i} className="flex items-center gap-2.5 text-[13px] text-[var(--text-secondary)]"><svg className="w-4 h-4 text-[var(--accent)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{f}</li>)}
      </ul>
      <Link href={ctaHref} className={`block text-center py-3 rounded-lg text-[13px] font-semibold transition-all ${highlighted ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]' : 'bg-white/[0.04] border border-white/[0.08] text-[var(--text-primary)] hover:bg-white/[0.07] hover:border-white/[0.12]'}`}>{cta}</Link>
    </div>
  );
}
