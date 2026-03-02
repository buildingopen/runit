'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function MarketingPage() {
  const [stickyVisible, setStickyVisible] = useState(false);

  useEffect(() => {
    const sections = document.querySelectorAll('.fade-in-section');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.08 }
    );
    sections.forEach((s) => observer.observe(s));

    const handleScroll = () => setStickyVisible(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[var(--accent)] rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-[var(--text-primary)] text-[15px]">Runtime</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Sign in</Link>
            <Link href="/signup" className="cta-primary px-5 py-2 text-[13px] font-medium text-white rounded-lg transition-all">Go live for free</Link>
          </div>
        </div>
      </nav>

      {/* ═══════════ SECTION 1: HERO ═══════════ */}
      <section className="relative pt-28 pb-16 px-6 overflow-hidden">
        <div className="hero-gradient absolute inset-0 pointer-events-none" />
        <div className="hero-grid absolute inset-0 pointer-events-none" />

        <div className="relative max-w-[1100px] mx-auto">
          <div className="text-center mb-12">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[var(--accent)]/[0.08] border border-[var(--accent)]/20 rounded-full mb-7 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              <span className="text-[12px] font-medium text-[var(--accent)]">Now in beta</span>
            </div>

            {/* Headline */}
            <h1 className="text-[38px] sm:text-[52px] md:text-[68px] font-extrabold text-[var(--text-primary)] leading-[1.02] tracking-tight mb-5">
              You built it with AI.
              <br />
              <span className="gradient-text">We make it live.</span>
            </h1>

            <p className="text-[17px] md:text-[19px] text-[var(--text-secondary)] leading-relaxed max-w-[500px] mx-auto mb-9">
              Turn any Python script into a live app with a shareable link. No servers, no Docker, no devops.
            </p>

            {/* CTA + Waitlist */}
            <div className="flex flex-col items-center gap-5">
              <Link href="/signup" className="cta-primary px-10 py-4 text-[16px] font-semibold text-white rounded-xl transition-all">
                Go live for free
              </Link>
              <WaitlistForm source="hero" />
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-7 text-[13px] text-[var(--text-tertiary)]">
              {['Free forever', 'No credit card', '60 second deploy'].map((text) => (
                <span key={text} className="flex items-center gap-1.5 whitespace-nowrap">
                  <svg className="w-3.5 h-3.5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  {text}
                </span>
              ))}
            </div>
          </div>

          {/* Terminal */}
          <div className="max-w-[660px] mx-auto">
            <div className="terminal-glow rounded-xl bg-[#0a0a0c] overflow-hidden transition-all duration-300">
              <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[11px] text-[var(--text-tertiary)] ml-2 font-mono">terminal</span>
              </div>
              <div className="p-5 font-mono text-[13px] leading-[1.8]">
                <div className="term-line term-line-1 text-[var(--text-tertiary)]"><span className="text-[var(--accent)]">$</span> Uploading invoice_generator.zip... <span className="text-[var(--text-secondary)]">done</span></div>
                <div className="term-line term-line-2 text-[var(--text-tertiary)] mt-1"><span className="text-[var(--accent)]">$</span> Installing dependencies... <span className="text-[var(--text-secondary)]">done</span></div>
                <div className="term-line term-line-3 text-[var(--text-tertiary)]"><span className="text-[var(--accent)]">$</span> Scanning for actions... <span className="text-[var(--accent)]">3 found</span></div>
                <div className="term-line term-line-4 text-[var(--text-tertiary)]"><span className="text-[var(--accent)]">$</span> Going live... <span className="text-[var(--accent)] font-semibold">ready</span></div>
                <div className="term-line term-line-5 mt-3 pt-3 border-t border-white/[0.06]">
                  <span className="text-[var(--text-tertiary)]">Your app is live at</span><br />
                  <span className="text-[var(--accent)] font-semibold">https://runtime.dev/s/ab3f9k2</span>
                </div>
                <div className="term-line term-line-6 mt-3 text-[var(--text-tertiary)]">
                  <span className="text-[var(--accent)]">$</span>{' '}
                  <span className="inline-block w-2 h-4 bg-[var(--accent)] animate-pulse align-middle rounded-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION 2: PRODUCT MOCKUP ═══════════ */}
      <section className="fade-in-section section-glow-top py-20 px-6">
        <div className="max-w-[1040px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[30px] md:text-[36px] font-bold text-[var(--text-primary)] mb-3">Your code gets a UI. <span className="gradient-text">Automatically.</span></h2>
            <p className="text-[var(--text-secondary)] text-[16px]">Upload a Python script. We generate a web interface. Anyone can use it.</p>
          </div>

          <div className="mockup-frame shadow-2xl shadow-black/50">
            <div className="bg-[#0a0a0c] rounded-xl overflow-hidden">
              {/* App header */}
              <div className="flex items-center gap-3 px-5 py-3.5 bg-white/[0.02] border-b border-white/[0.06]">
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-[var(--text-tertiary)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                </div>
                <div>
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">Invoice Generator</span>
                  <span className="text-[12px] text-[var(--text-tertiary)] ml-2">/generate</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-[var(--accent)]/[0.08] border border-[var(--accent)]/20 rounded-md">
                  <svg className="w-3.5 h-3.5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.497a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.69" /></svg>
                  <span className="text-[11px] font-medium text-[var(--accent)]">Share</span>
                </div>
              </div>
              {/* Split panel */}
              <div className="grid md:grid-cols-2 divide-x divide-white/[0.06]">
                <div className="p-7 md:p-8">
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
                      <div className="cta-primary w-full py-3 rounded-lg text-white text-[14px] font-semibold text-center flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
                        Run
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-7 md:p-8 bg-white/[0.01]">
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
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION 3: HOW IT WORKS ═══════════ */}
      <section className="fade-in-section section-glow-top pt-20 pb-12 px-6">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[30px] md:text-[36px] font-bold text-[var(--text-primary)] mb-3">Three steps. <span className="gradient-text">Sixty seconds.</span></h2>
            <p className="text-[var(--text-secondary)] text-[16px]">From code on your laptop to a live app anyone can use.</p>
          </div>

          {/* Desktop */}
          <div className="hidden md:grid md:grid-cols-3 gap-0">
            <div className="relative p-4">
              <StepCard number="1" title="Upload your code" description="Paste a Python script or drop a .zip file. We handle the rest." icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>} />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 rounded-full bg-[var(--bg-primary)] border border-[var(--accent)]/20 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </div>
            </div>
            <div className="relative p-4">
              <StepCard number="2" title="We build your app" description="Your code gets a live URL and an auto-generated interface. No frontend needed." icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.385 3.17M6.09 6.09l5.33 3.168m0 0l5.33-3.168M11.42 9.26v6.91m5.385 3.17L21.75 16.5V7.5l-4.945-2.83M6.09 6.09L1.145 3.26v9l4.945 2.83" /></svg>} />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-8 h-8 rounded-full bg-[var(--bg-primary)] border border-[var(--accent)]/20 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
              </div>
            </div>
            <div className="p-4">
              <StepCard number="3" title="Share the link" description="Anyone can run your app from their browser. Share it with your team, clients, or the world." icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>} />
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden step-connector space-y-4 py-4">
            {[
              { n: '1', t: 'Upload your code', d: 'Paste a Python script or drop a .zip file. We handle the rest.', i: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg> },
              { n: '2', t: 'We build your app', d: 'Your code gets a live URL and an auto-generated interface. No frontend needed.', i: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.385 3.17M6.09 6.09l5.33 3.168m0 0l5.33-3.168M11.42 9.26v6.91m5.385 3.17L21.75 16.5V7.5l-4.945-2.83M6.09 6.09L1.145 3.26v9l4.945 2.83" /></svg> },
              { n: '3', t: 'Share the link', d: 'Anyone can run your app from their browser. Share it with your team, clients, or the world.', i: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg> },
            ].map((s) => (
              <div key={s.n} className="relative z-10">
                <StepCard number={s.n} title={s.t} description={s.d} icon={s.i} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION 4: SOCIAL PROOF ═══════════ */}
      <section className="fade-in-section section-glow-top pt-14 pb-20 px-6">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[30px] md:text-[36px] font-bold text-[var(--text-primary)] mb-3">Built for people who <span className="gradient-text">create with AI</span></h2>
            <p className="text-[var(--text-secondary)] text-[16px]">You don&apos;t need to be a devops engineer to ship software.</p>
          </div>

          {/* Audience cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-16">
            <AudienceCard
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" /></svg>}
              title="Cursor users"
              description="You wrote a Python script with Cursor. Now what? Upload it here and get a live app with a URL in under a minute."
            />
            <AudienceCard
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
              title="n8n & Make users"
              description="Need custom logic your automation tool can't handle? Deploy a Python function and call it as a webhook from your flow."
            />
            <AudienceCard
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>}
              title="ChatGPT users"
              description="ChatGPT gave you working code. Runtime turns it into a real app anyone can use, with a UI and a shareable link."
            />
          </div>

          {/* Testimonials */}
          <div className="text-center mb-8">
            <h3 className="text-[18px] font-semibold text-[var(--text-secondary)]">What early users are saying</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <TestimonialCard
              quote="I had a Python script from ChatGPT. 60 seconds later it was a live app with a URL."
              name="Alex M."
              role="Early tester"
              initials="AM"
              color="bg-emerald-500/20"
            />
            <TestimonialCard
              quote="Finally I can share my automations without explaining Docker to my team."
              name="Sarah K."
              role="n8n user"
              initials="SK"
              color="bg-cyan-500/20"
            />
            <TestimonialCard
              quote="Built 3 internal tools in an afternoon. Would've taken a week to deploy normally."
              name="James L."
              role="Cursor user"
              initials="JL"
              color="bg-violet-500/20"
            />
          </div>
        </div>
      </section>

      {/* ═══════════ SECTION 5: FINAL CTA ═══════════ */}
      <section className="fade-in-section relative py-24 px-6 overflow-hidden">
        {/* Dramatic gradient bg */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/[0.06] via-[var(--accent)]/[0.03] to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[var(--accent)]/[0.05] rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-cyan-500/[0.03] rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-[580px] mx-auto text-center">
          <h2 className="text-[36px] md:text-[44px] font-extrabold text-[var(--text-primary)] mb-5 leading-tight">
            Your code deserves to be <span className="gradient-text">live.</span>
          </h2>
          <p className="text-[var(--text-secondary)] text-[17px] mb-9 leading-relaxed">
            Stop sharing screenshots of terminal output. Go live in 60 seconds and send a link.
          </p>
          <Link href="/signup" className="cta-primary inline-flex px-10 py-4 text-[16px] font-semibold text-white rounded-xl transition-all">
            Go live for free
          </Link>
          <div className="mt-7">
            <WaitlistForm source="cta" />
          </div>
          <p className="mt-5 text-[13px] text-[var(--text-tertiary)]">Join 200+ builders on the waitlist</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/[0.06]">
        <div className="max-w-[900px] mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[var(--accent)] rounded-md flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.2)]">
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

      {/* Sticky mobile CTA */}
      <div className={`sticky-mobile-cta ${stickyVisible ? 'visible' : ''}`}>
        <Link href="/signup" className="cta-primary block w-full py-3 text-[14px] font-semibold text-white rounded-lg text-center transition-all">
          Go live for free
        </Link>
      </div>
    </div>
  );
}

/* ═══════════ COMPONENTS ═══════════ */

function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setStatus('error');
        setErrorMsg('Service unavailable. Try signing up instead.');
        return;
      }
      const { error } = await supabase.from('waitlist').insert({ email: email.toLowerCase().trim(), source });
      if (error) {
        if (error.code === '23505') setStatus('success');
        else { setStatus('error'); setErrorMsg('Something went wrong. Try again.'); }
      } else {
        setStatus('success');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center gap-2 text-[14px] text-[var(--accent)] font-medium py-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        You&apos;re on the list!
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="waitlist-form flex items-center gap-2 max-w-[440px] mx-auto">
      <input
        type="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="waitlist-input flex-1 min-w-0 px-4 py-2.5 text-[14px] rounded-lg"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="waitlist-submit px-5 py-2.5 text-[13px] font-semibold text-white rounded-lg transition-all disabled:opacity-50"
      >
        {status === 'loading' ? 'Joining...' : 'Get early access'}
      </button>
      {status === 'error' && (
        <p className="absolute -bottom-6 left-0 text-[12px] text-[var(--error)]">{errorMsg}</p>
      )}
    </form>
  );
}

function StepCard({ number, title, description, icon }: { number: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="glass-card relative p-7 rounded-2xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="step-badge w-10 h-10 rounded-xl flex items-center justify-center">
          <span className="text-[15px] font-bold text-white">{number}</span>
        </div>
        <div className="w-10 h-10 bg-[var(--accent)]/[0.08] rounded-xl flex items-center justify-center text-[var(--accent)]">{icon}</div>
      </div>
      <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function AudienceCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass-card p-6 rounded-2xl">
      <div className="w-10 h-10 bg-[var(--accent)]/[0.08] rounded-xl flex items-center justify-center text-[var(--accent)] mb-4">{icon}</div>
      <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function TestimonialCard({ quote, name, role, initials, color }: { quote: string; name: string; role: string; initials: string; color: string }) {
  return (
    <div className="testimonial-card p-6 rounded-2xl">
      <svg className="w-5 h-5 text-[var(--accent)]/30 mb-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151C7.563 6.068 6 8.789 6 11h4v10H0z" />
      </svg>
      <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-5">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className={`avatar-circle ${color}`}>{initials}</div>
        <div>
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">{name}</div>
          <div className="text-[12px] text-[var(--text-tertiary)]">{role}</div>
        </div>
      </div>
    </div>
  );
}
