import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  LayoutGrid,
  ShieldCheck,
  Upload,
  Wrench,
  FileText,
} from 'lucide-react';
import { cx } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { HeroTopology } from '@/components/landing/HeroTopology';
import {
  DEMO_NOTES,
  FEATURE_LINKS,
  HERO_METRICS,
  HOW_IT_WORKS,
  PLATFORM_STRIP,
  SectionLabel,
  VALUE_CARDS,
} from '@/components/landing/content';

/* =============================================================================
 * CYBERSURE landing page
 * -----------------------------------------------------------------------------
 * The first screen a visitor sees. It is deliberately outside the application
 * shell: the console is only entered by pressing Start Assessment.
 * ========================================================================== */

const NAV_LINKS = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'features', label: 'Features' },
  { id: 'about', label: 'About' },
];

/** Smooth in-page scrolling for the marketing sections. */
function useSectionScroll() {
  useEffect(() => {
    const handler = (event: Event) => {
      const target = (event.target as HTMLElement | null)?.closest('a[href^="#"]');
      if (!target) return;
      const id = target.getAttribute('href');
      if (!id) return;
      const element = document.querySelector(id);
      if (!element) return;
      event.preventDefault();
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);
}

function SiteHeader({ onStart }: { onStart: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cx(
        'sticky top-0 z-40 border-b transition-colors',
        scrolled
          ? 'border-ink-700/80 bg-ink-950/85 backdrop-blur [html.light_&]:border-ink-100 [html.light_&]:bg-white/85'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">CYBERSURE</span>
        </span>

        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Landing sections">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-300 transition-colors hover:text-ink-50 [html.light_&]:text-ink-600 [html.light_&]:hover:text-ink-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button variant="primary" size="sm" onClick={onStart} iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
            Start Assessment
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative overflow-hidden pb-16 pt-12 sm:pt-16">
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-accent-500/[0.07] blur-3xl [html.light_&]:bg-accent-500/[0.09]"
        aria-hidden
      />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div className="animate-rise-in">
          <h1 className="text-balance text-[34px] font-semibold leading-[1.1] tracking-tight text-ink-50 [html.light_&]:text-ink-900 sm:text-[44px]">
            Secure Your Network.
            <br />
            <span className="text-ink-300 [html.light_&]:text-ink-600">Simplify Your Configuration.</span>
          </h1>

          <p className="mt-5 max-w-xl text-balance text-[14.5px] leading-relaxed text-dim">
            Analyze network configurations, identify security risks, improve compliance, and convert configurations
            across network platforms — all from one place.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Button variant="primary" size="lg" onClick={onStart} iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}>
              Start Assessment
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' })}
              icon={<LayoutGrid className="h-4 w-4" aria-hidden />}
            >
              Explore Features
            </Button>
          </div>

          <dl className="mt-9 grid max-w-lg grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {HERO_METRICS.map((metric) => (
              <div key={metric.label}>
                <dt className="eyebrow">{metric.label}</dt>
                <dd className="mt-1 text-[20px] font-semibold leading-none tabular-nums text-ink-50 [html.light_&]:text-ink-900">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative pb-8 lg:pb-0">
          <HeroTopology />
        </div>
      </div>
    </section>
  );
}

function ValueSection() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-ink-800/70 py-16 [html.light_&]:border-ink-100">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionLabel>What CYBERSURE does</SectionLabel>
        <h2 className="mt-3 max-w-2xl text-balance text-[24px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900 sm:text-[28px]">
          Four capabilities, one configuration source of truth.
        </h2>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-dimmer">
          Every screen in the console is driven by the same analysis engine, so a remediation in one place
          changes the dashboard, the compliance score, the change history and the reports. Configuration
          conversion runs on the CYBERSURE conversion service, which parses a configuration into a normalized
          network model and re-renders it in any supported platform&apos;s syntax.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {VALUE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="surface group p-5 transition-colors hover:border-accent-500/40"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-500/30 bg-accent-500/10 text-accent-300 [html.light_&]:border-accent-200 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{card.title}</h3>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-dimmer">{card.body}</p>
                  </div>
                </div>
                <ul className="mt-3.5 flex flex-wrap gap-1.5 pl-12">
                  {card.points.map((point) => (
                    <li
                      key={point}
                      className="rounded-md border border-ink-700/70 bg-ink-850 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-300 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-600"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {PLATFORM_STRIP.map((platform) => (
            <span
              key={platform}
              className="rounded-md border border-ink-700/70 bg-ink-900 px-2 py-1 font-mono text-[11px] text-ink-300 [html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:text-ink-600"
            >
              {platform}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-ink-800/70 py-16 [html.light_&]:border-ink-100">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionLabel>How it works</SectionLabel>
        <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900 sm:text-[28px]">
          Four steps from device to report.
        </h2>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((entry) => (
            <li key={entry.step} className="surface relative p-5">
              <p className="font-mono text-[22px] font-semibold leading-none text-accent-500/70">{entry.step}</p>
              <h3 className="mt-3 text-[13.5px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{entry.title}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-dimmer">{entry.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" className="scroll-mt-20 border-t border-ink-800/70 py-16 [html.light_&]:border-ink-100">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <SectionLabel>About this build</SectionLabel>
          <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900 sm:text-[28px]">
            A working prototype, honestly scoped.
          </h2>
          <p className="mt-4 text-[13.5px] leading-relaxed text-dim">
            CYBERSURE demonstrates the complete workflow: understand devices, inspect configuration, detect insecure
            settings, convert configuration between vendors, identify compliance gaps, validate changes and generate
            reports — with an assistant that explains any of it in context.
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-dim">
            The analysis engine, the converter and the assistant all run locally in the browser. There is no backend, no
            vendor integration and no network access of any kind.
          </p>

          <ul className="mt-5 space-y-2">
            {DEMO_NOTES.map((note) => (
              <li
                key={note.text}
                className="flex items-start gap-2.5 rounded-lg border border-ink-700/70 bg-ink-900 px-3 py-2.5 text-[12.5px] text-ink-200 [html.light_&]:border-ink-100 [html.light_&]:bg-white [html.light_&]:text-ink-700"
              >
                <span className="mt-0.5 text-accent-400 [html.light_&]:text-accent-600">{note.icon}</span>
                {note.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURE_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="surface group flex flex-col p-4 transition-colors hover:border-accent-500/40"
            >
              <span className="text-[13px] font-semibold text-ink-50 [html.light_&]:text-ink-900">{link.title}</span>
              <span className="mt-1.5 flex-1 text-[12px] leading-relaxed text-dimmer">{link.body}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-400 [html.light_&]:text-accent-600">
                Open
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-ink-800/70 py-10 [html.light_&]:border-ink-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent-500 to-accent-700 text-white">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="text-[14px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">CYBERSURE</span>
          </span>
          <p className="mt-2 max-w-md text-[11.5px] leading-relaxed text-dimmer">
            Intelligent Network Security Configuration &amp; Compliance Platform. All devices, configurations, findings and
            reports are fictional.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { icon: <Upload className="h-3 w-3" aria-hidden />, label: 'No live connections' },
            { icon: <Wrench className="h-3 w-3" aria-hidden />, label: 'Normalized conversion engine' },
            { icon: <FileText className="h-3 w-3" aria-hidden />, label: 'Configuration reports' },
          ].map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-700/70 bg-ink-900 px-2 py-1 text-[11px] text-ink-300 [html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:text-ink-600"
            >
              {chip.icon}
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  useSectionScroll();

  const startAssessment = () => {
    navigate('/assessment');
  };

  return (
    <div className="min-h-screen bg-ink-950 [html.light_&]:bg-ink-50">
      <SiteHeader onStart={startAssessment} />
      <main>
        <Hero onStart={startAssessment} />
        <ValueSection />
        <HowItWorksSection />
        <AboutSection />

        {/* Final call to action */}
        <section className="border-t border-ink-800/70 py-14 [html.light_&]:border-ink-100">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 text-center sm:px-6">
            <h2 className="text-balance text-[22px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900 sm:text-[26px]">
              Enter the assessment environment.
            </h2>
            <p className="max-w-xl text-balance text-[13px] leading-relaxed text-dimmer">
              The console opens on a dashboard with 12 sample devices, live findings and a posture score you can move by
              remediating a real configuration setting.
            </p>
            <Button variant="primary" size="lg" onClick={startAssessment} iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}>
              Start Assessment
            </Button>
            <p className="flex items-center gap-1.5 text-[11.5px] text-dimmer">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
              Runs entirely in your browser. Nothing leaves this machine.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
