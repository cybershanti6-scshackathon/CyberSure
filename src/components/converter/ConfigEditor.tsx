import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { cx } from '@/utils/format';

/* =============================================================================
 * Configuration editor
 * -----------------------------------------------------------------------------
 * A single component for both halves of the Configuration Converter. It renders
 * line numbers, lightweight vendor-aware syntax highlighting and, in editable
 * mode, a transparent textarea layered over the highlighted text so the caret
 * and the selection behave exactly like a normal text field.
 * ========================================================================== */

type TokenKind = 'comment' | 'keyword' | 'string' | 'number' | 'text';

interface Token {
  kind: TokenKind;
  value: string;
}

const COMMENT_PREFIXES = new Set(['!', '#', '//']);

/** Keywords per CLI family so the highlighting reads like the real platform. */
const KEYWORDS: Record<string, string[]> = {
  cisco: [
    'hostname', 'interface', 'ip', 'no', 'line', 'vty', 'transport', 'input', 'description', 'shutdown', 'end',
    'service', 'password-encryption', 'logging', 'host', 'buffered', 'ntp', 'server', 'route', 'vlan', 'banner',
    'snmp-server', 'community', 'mtu', 'exit', 'version', 'feature', 'username', 'aaa', 'crypto', 'router', 'access-list',
  ],
  junos: [
    'set', 'delete', 'commit', 'system', 'interfaces', 'unit', 'family', 'inet', 'address', 'description', 'host-name',
    'domain-name', 'services', 'ssh', 'protocol-version', 'routing-options', 'static', 'next-hop', 'syslog', 'file',
    'size', 'ntp', 'firewall', 'policer', 'vlan-tagging', 'edit', 'activate', 'login', 'message', 'root-login',
  ],
  fortios: ['config', 'edit', 'next', 'end', 'set', 'move', 'rename', 'purge'],
  panos: ['set', 'edit', 'delete', 'commit', 'merge', 'load', 'default', 'interface', 'deviceconfig', 'network', 'vlan', 'rulebase'],
  routeros: ['/system', '/interface', '/ip', '/routing', '/system', 'add', 'set', 'name', 'mtu', 'address', 'interface', 'servers', 'telnet', 'ssh', 'www', 'enabled', 'primary-ntp', 'disabled'],
  nxos: ['feature', 'vlan', 'interface', 'ip', 'no', 'description', 'switchport', 'line', 'vty', 'logging', 'ntp', 'end', 'hostname', 'vrf', 'exit'],
  aruba: ['hostname', 'vlan', 'interface', 'ip', 'description', 'no', 'shutdown', 'end', 'exit', 'wlan'],
};

const FAMILY_BY_PLATFORM: Record<string, keyof typeof KEYWORDS> = {
  'cisco-iosxe': 'cisco',
  'cisco-ios': 'cisco',
  'cisco-nxos': 'nxos',
  'juniper-junos': 'junos',
  'fortinet-fortios': 'fortios',
  'paloalto-panos': 'panos',
  'mikrotik-routeros': 'routeros',
  'aruba-arubaos': 'aruba',
};

function tokenise(line: string, family: keyof typeof KEYWORDS): Token[] {
  if (line.trim().length === 0) return [{ kind: 'text', value: '' }];
  const indent = line.length - line.trimStart().length;
  const tokens: Token[] = [];
  if (indent > 0) tokens.push({ kind: 'text', value: ' '.repeat(indent) });

  const body = line.trimStart();
  if (COMMENT_PREFIXES.has(body[0])) {
    tokens.push({ kind: 'comment', value: body });
    return tokens;
  }

  const keywords = KEYWORDS[family] ?? [];
  const pattern = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)*(?:\/\d+)?\b)|([A-Za-z][\w.-]*)|(\s+)|(.)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const [value, string, number, word, space] = match;
    if (string) tokens.push({ kind: 'string', value });
    else if (number) tokens.push({ kind: 'number', value });
    else if (word) tokens.push({ kind: keywords.includes(word.toLowerCase()) ? 'keyword' : 'text', value });
    else if (space) tokens.push({ kind: 'text', value });
    else tokens.push({ kind: 'text', value });
  }
  return tokens;
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: 'text-ink-500 [html.light_&]:text-ink-400 italic',
  keyword: 'text-accent-300 [html.light_&]:text-accent-700',
  string: 'text-emerald-300 [html.light_&]:text-emerald-700',
  number: 'text-amber-300 [html.light_&]:text-amber-700',
  text: 'text-ink-100 [html.light_&]:text-ink-800',
};

function HighlightedLine({ line, family }: { line: string; family: keyof typeof KEYWORDS }) {
  const tokens = useMemo(() => tokenise(line, family), [line, family]);
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} className={TOKEN_CLASS[token.kind]}>
          {token.value}
        </span>
      ))}
    </>
  );
}

export function ConfigEditor({
  value,
  onChange,
  readOnly = false,
  platform,
  minHeight = 320,
  label,
  emptyHint,
  highlightLines,
  onLineClick,
  textareaRef: externalTextareaRef,
  className,
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  platform: string;
  minHeight?: number;
  label: string;
  emptyHint?: string;
  /** 1-based source line numbers to tint (used for review/warning markers). */
  highlightLines?: { line: number; tone: 'warn' | 'fail' | 'ok' }[];
  onLineClick?: (line: number) => void;
  /** Optional external ref so a parent control can focus the editor. */
  textareaRef?: RefObject<HTMLTextAreaElement>;
  className?: string;
}) {
  const family = FAMILY_BY_PLATFORM[platform] ?? 'cisco';
  const localTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef ?? localTextareaRef;
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = value.split('\n');
  const highlightMap = useMemo(() => {
    const map = new Map<number, 'warn' | 'fail' | 'ok'>();
    for (const entry of highlightLines ?? []) map.set(entry.line, entry.tone);
    return map;
  }, [highlightLines]);

  // Keep the gutter aligned with the textarea while scrolling.
  useEffect(() => {
    const textarea = textareaRef.current;
    const gutter = gutterRef.current;
    if (!textarea || !gutter) return undefined;
    const sync = () => {
      gutter.scrollTop = textarea.scrollTop;
    };
    textarea.addEventListener('scroll', sync);
    return () => textarea.removeEventListener('scroll', sync);
  }, []);

  const isEmpty = value.trim().length === 0;

  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-lg border border-ink-700 bg-ink-950 [html.light_&]:border-ink-200 [html.light_&]:bg-white',
        className,
      )}
      style={{ minHeight }}
    >
      <div className="flex max-h-[520px] overflow-hidden">
        {/* Gutter */}
        <div
          ref={gutterRef}
          aria-hidden
          className="w-11 shrink-0 select-none overflow-hidden border-r border-ink-800 bg-ink-900/60 text-right [html.light_&]:border-ink-100 [html.light_&]:bg-ink-50"
        >
          {lines.map((_, index) => {
            const tone = highlightMap.get(index + 1);
            return (
              <div
                key={index}
                onClick={onLineClick ? () => onLineClick(index + 1) : undefined}
                className={cx(
                  'flex h-[19px] items-center justify-end pr-2 font-mono text-[11px] leading-none text-ink-500 [html.light_&]:text-ink-400',
                  onLineClick && 'cursor-pointer hover:text-accent-400',
                  tone === 'warn' && 'text-amber-400',
                  tone === 'fail' && 'text-red-400',
                  tone === 'ok' && 'text-emerald-400',
                )}
              >
                {index + 1}
              </div>
            );
          })}
        </div>

        {/* Code surface */}
        <div className="relative min-w-0 flex-1">
          {isEmpty ? (
            <div
              className="flex items-center justify-center p-6 text-center text-[12px] text-dimmer"
              style={{ minHeight }}
            >
              {emptyHint ?? 'No configuration loaded. Paste a configuration or upload a file.'}
            </div>
          ) : (
            <>
              <pre
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden p-3 font-mono text-[11.5px] leading-[19px] [html.light_&]:text-ink-800"
              >
                {lines.map((line, index) => (
                  <div key={index} className="h-[19px] whitespace-pre">
                    <HighlightedLine line={line} family={family} />
                  </div>
                ))}
              </pre>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
                readOnly={readOnly}
                spellCheck={false}
                aria-label={label}
                className={cx(
                  'relative h-full w-full resize-none bg-transparent p-3 font-mono text-[11.5px] leading-[19px] text-transparent caret-ink-100 outline-none [html.light_&]:caret-ink-900',
                  '[&::selection]:bg-accent-500/30',
                  readOnly && 'cursor-default',
                )}
                style={{ minHeight, caretColor: undefined }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
