import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  FileCode2,
  FileText,
  Info,
  Network,
  Send,
  ShieldAlert,
  Sparkles,
  User,
} from 'lucide-react';
import type { AssistantContext, AssistantMessage, ReportKind } from '@/types';
import { useCyberSure } from '@/lib/store';
import {
  ASSISTANT_DISCLAIMER,
  QUICK_ACTIONS,
  assistantMessage,
  buildAssistantAnswer,
  userMessage,
} from '@/lib/assistant';
import { cx, relativeTime } from '@/utils/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Primitives';

const RELATED_ICON = {
  finding: ShieldAlert,
  device: Network,
  report: FileText,
  conversion: FileCode2,
} as const;

const SUGGESTED_PROMPTS = [
  'Why is Telnet considered insecure?',
  'What does this firewall finding mean?',
  'How can I fix this issue?',
  'Summarize security posture',
  'Explain the configuration conversion result.',
  'What does this compliance warning mean?',
];

function Bubble({
  message,
  onNavigate,
}: {
  message: AssistantMessage;
  onNavigate: (to: string) => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={cx('flex gap-3', isUser && 'flex-row-reverse')}>
      <span
        className={cx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
          isUser
            ? 'border-ink-600 bg-ink-800 text-ink-200 [html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:text-ink-700'
            : 'border-accent-500/40 bg-accent-500/12 text-accent-300 [html.light_&]:border-accent-200 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700',
        )}
        aria-hidden
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>

      <div className={cx('min-w-0 max-w-[min(760px,88%)]', isUser && 'flex flex-col items-end')}>
        <div
          className={cx(
            'rounded-xl border px-3.5 py-3',
            isUser
              ? 'border-ink-600 bg-ink-800 text-ink-100 [html.light_&]:border-ink-200 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-800'
              : 'surface',
          )}
        >
          <p className="text-[12.5px] leading-relaxed text-dim">{message.text}</p>

          {message.bullets && message.bullets.length > 0 ? (
            <ul className="mt-2.5 space-y-1.5 border-t border-ink-700/60 pt-2.5 [html.light_&]:border-ink-100">
              {message.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-[12px] leading-relaxed text-dimmer">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-400 [html.light_&]:bg-accent-600" aria-hidden />
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}

          {message.related && message.related.length > 0 ? (
            <div className="mt-3">
              <p className="eyebrow mb-1.5">Related in this session</p>
              <div className="flex flex-wrap gap-1.5">
                {message.related.map((item) => {
                  const Icon = RELATED_ICON[item.kind];
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => onNavigate(item.to)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] font-medium text-ink-200 transition-colors hover:border-accent-500/50 hover:text-accent-200 [html.light_&]:border-ink-200 [html.light_&]:bg-white [html.light_&]:text-ink-700 [html.light_&]:hover:text-accent-700"
                    >
                      <Icon className="h-3 w-3" aria-hidden />
                      <span className="max-w-[220px] truncate">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <p className={cx('mt-1 px-1 text-[10.5px] text-dimmer', isUser && 'text-right')}>
          {message.role === 'assistant' ? 'CYBERSURE Assistant · ' : ''}
          {relativeTime(message.createdAt)}
          {message.context ? ` · context: ${message.context.label}` : ''}
        </p>
      </div>
    </div>
  );
}

export function AssistantPage() {
  const { analysis, devices, conversions, reports } = useCyberSure();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [context, setContext] = useState<AssistantContext | undefined>(undefined);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const bundle = useMemo(
    () => ({
      analysis,
      devices,
      lastConversion: conversions[0]?.result ?? null,
      report: null,
    }),
    [analysis, devices, conversions],
  );

  const reportContextKind = searchParams.get('kind') as ReportKind | null;
  const activeReport = reportContextKind ? reports.find((report) => report.kind === reportContextKind) : undefined;

  /* ---------------- Deep links: ?context=conversion|finding|device|report ---------------- */
  useEffect(() => {
    const requested = searchParams.get('context');
    if (!requested) return;

    if (requested === 'conversion') {
      const last = conversions[0]?.result;
      setContext({
        topic: 'conversion',
        refId: last?.id,
        label: last ? `Latest conversion ${last.id}` : 'Latest conversion',
        detail: last ? `${last.processed} commands processed` : undefined,
      });
    } else if (requested === 'finding') {
      const focus = searchParams.get('finding');
      const finding = analysis.findings.find((candidate) => candidate.id === focus) ?? analysis.findings[0];
      if (finding) {
        setContext({
          topic: 'finding',
          refId: finding.id,
          label: finding.title,
          detail: finding.deviceId,
        });
      }
    } else if (requested === 'device') {
      const deviceId = searchParams.get('device');
      const device = devices.find((candidate) => candidate.id === deviceId) ?? devices[0];
      if (device) {
        setContext({ topic: 'device', refId: device.id, label: device.name, detail: `${device.vendor} · ${device.ipAddress}` });
      }
    } else if (requested === 'report') {
      setContext({
        topic: 'report',
        refId: reportContextKind ?? undefined,
        label: reportContextKind ? `${reportContextKind} report` : 'Selected report',
      });
    } else if (requested === 'compliance') {
      setContext({ topic: 'compliance', label: 'Compliance controls' });
    } else if (requested === 'posture') {
      setContext({ topic: 'posture', label: 'Estate security posture' });
    }

    // Seed a first answer so the page is never an empty chat.
    setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* ---------------- Auto-greeting grounded in current state ---------------- */
  useEffect(() => {
    if (messages.length > 0) return;
    const open = analysis.findings.filter((finding) => finding.status === 'open');
    const top = open[0];
    const answer = buildAssistantAnswer('Summarize security posture', context, {
      ...bundle,
      report: activeReport ?? null,
    });
    setMessages([
      userMessage('Summarize security posture', context),
      {
        ...assistantMessage(
          {
            text: `Welcome to the CYBERSURE assistant. ${answer.text}`,
            bullets: [
              ...(answer.bullets ?? []),
              top ? `Start with the highest-priority open finding: “${top.title}” on ${top.deviceId}.` : 'No open findings remain in the estate.',
              ...SUGGESTED_PROMPTS.slice(0, 3),
            ],
            related: answer.related,
          },
          context,
        ),
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, thinking]);

  const send = useCallback(
    (text: string, nextContext?: AssistantContext) => {
      const trimmed = text.trim();
      if (trimmed.length === 0 || thinking) return;
      const activeContext = nextContext ?? context;
      setMessages((current) => [...current, userMessage(trimmed, activeContext)]);
      setDraft('');
      setThinking(true);
      setTimeout(() => {
        const answer = buildAssistantAnswer(trimmed, activeContext, { ...bundle, report: activeReport ?? null });
        setMessages((current) => [...current, assistantMessage(answer, activeContext)]);
        setThinking(false);
      }, 420);
    },
    [context, thinking, bundle, activeReport],
  );

  const contextOptions = useMemo(() => {
    const options: { id: string; label: string; value: AssistantContext | undefined }[] = [
      { id: 'none', label: 'Whole estate', value: undefined },
      { id: 'posture', label: 'Security posture', value: { topic: 'posture', label: 'Estate security posture' } },
      { id: 'compliance', label: 'Compliance', value: { topic: 'compliance', label: 'Compliance controls' } },
    ];
    if (conversions[0]) {
      options.push({
        id: 'conversion',
        label: 'Latest conversion',
        value: { topic: 'conversion', refId: conversions[0].result.id, label: `Conversion ${conversions[0].result.id}` },
      });
    }
    if (activeReport) {
      options.push({ id: 'report', label: 'Current report', value: { topic: 'report', refId: activeReport.kind, label: activeReport.title } });
    }
    const topFinding = analysis.findings.find((finding) => finding.status === 'open');
    if (topFinding) {
      options.push({
        id: 'finding',
        label: 'Top open finding',
        value: { topic: 'finding', refId: topFinding.id, label: topFinding.title, detail: topFinding.deviceId },
      });
    }
    if (devices[0]) {
      options.push({
        id: 'device',
        label: devices[0].name,
        value: { topic: 'device', refId: devices[0].id, label: devices[0].name, detail: devices[0].ipAddress },
      });
    }
    return options;
  }, [analysis.findings, devices, conversions, activeReport]);

  const currentContextId = context
    ? context.topic === 'conversion'
      ? 'conversion'
      : context.topic === 'report'
        ? 'report'
        : context.topic === 'finding'
          ? 'finding'
          : context.topic === 'device'
            ? 'device'
            : context.topic
    : 'none';

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-50 [html.light_&]:text-ink-900">CYBERSURE Assistant</h1>
          <p className="mt-1 text-[12.5px] text-dimmer">Understand configuration findings and security recommendations.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-dimmer">No network access</span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* Conversation */}
        <Card className="flex min-h-[560px] flex-col">
          <CardHeader
            title="Conversation"
            description="Answers are composed locally from the configuration in this prototype."
            icon={<Bot className="h-4 w-4" aria-hidden />}
            action={
              context ? (
                <Badge tone="info" icon={<Info className="h-3 w-3" aria-hidden />}>
                  Context: {context.label}
                </Badge>
              ) : (
                <Badge tone="neutral">Context: whole estate</Badge>
              )
            }
          />

          {/* Quick actions */}
          <div className="flex flex-wrap gap-1.5 border-b border-ink-700/70 px-4 py-2.5 [html.light_&]:border-ink-100">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => send(action.prompt, action.context ?? context)}
                className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-[11.5px] font-medium text-ink-200 transition-colors hover:border-accent-500/50 hover:text-accent-200 [html.light_&]:border-ink-200 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-700 [html.light_&]:hover:text-accent-700"
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                {action.label}
              </button>
            ))}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scroll-thin">
            {messages.map((message) => (
              <Bubble key={message.id} message={message} onNavigate={(to) => navigate(to)} />
            ))}
            {thinking ? (
              <div className="flex items-center gap-2.5 text-[12px] text-dimmer">
                <Spinner className="text-accent-400 [html.light_&]:text-accent-600" />
                Reading the configuration…
              </div>
            ) : null}
          </div>

          {/* Composer */}
          <div className="border-t border-ink-700/70 px-4 py-3 [html.light_&]:border-ink-100">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send(draft);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send(draft);
                  }
                }}
                rows={2}
                placeholder="Ask about a finding, a device, a conversion or a report…"
                aria-label="Message the CYBERSURE assistant"
                className="field min-h-[58px] resize-none py-2"
              />
              <Button type="submit" variant="primary" loading={thinking} disabled={draft.trim().length === 0} icon={<Send className="h-3.5 w-3.5" aria-hidden />}>
                Send
              </Button>
            </form>
            <p className="mt-1.5 text-[10.5px] text-dimmer">Enter to send · Shift+Enter for a new line</p>
          </div>
        </Card>

        {/* Side panel */}
        <div className="space-y-3">
          <Card>
            <CardHeader title="Context" description="The assistant answers about whatever you anchor it to." icon={<Info className="h-4 w-4" aria-hidden />} />
            <CardBody className="space-y-1.5">
              {contextOptions.map((option) => {
                const active = option.id === currentContextId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setContext(option.value);
                      if (option.value) send('Explain this in the current context', option.value);
                    }}
                    className={cx(
                      'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors',
                      active
                        ? 'border-accent-500/50 bg-accent-500/10 text-accent-200 [html.light_&]:border-accent-200 [html.light_&]:bg-accent-50 [html.light_&]:text-accent-700'
                        : 'border-ink-700/70 bg-ink-850 text-ink-200 hover:border-accent-500/30 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50 [html.light_&]:text-ink-700',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {active ? <ArrowRight className="ml-auto h-3 w-3 shrink-0" aria-hidden /> : null}
                  </button>
                );
              })}
              {context ? (
                <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setContext(undefined)}>
                  Clear context
                </Button>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Suggested questions" icon={<Sparkles className="h-4 w-4" aria-hidden />} />
            <CardBody className="space-y-1.5">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className="w-full rounded-lg border border-ink-700/70 bg-ink-850 px-2.5 py-2 text-left text-[11.5px] leading-relaxed text-dimmer transition-colors hover:border-accent-500/40 hover:text-ink-200 [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50 [html.light_&]:hover:text-ink-700"
                >
                  {prompt}
                </button>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="What this assistant is" icon={<Bot className="h-4 w-4" aria-hidden />} />
            <CardBody className="space-y-2 text-[11.5px] leading-relaxed text-dimmer">
              <p>{ASSISTANT_DISCLAIMER}</p>
              <ul className="space-y-1.5">
                {[
                  'It explains findings, devices, conversions and reports already visible in this prototype.',
                  'It is context-aware: anchor it to a finding, device, conversion or report and it answers about that object.',
                  'It is not a threat intelligence feed, a live SOC, or a chatbot attached to real infrastructure.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-400 [html.light_&]:bg-accent-600" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
