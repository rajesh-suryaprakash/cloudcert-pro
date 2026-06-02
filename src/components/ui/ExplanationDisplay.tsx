/**
 * ExplanationDisplay
 *
 * Renders a question explanation that may be either:
 *   1. A structured JSON object:
 *      { "general explanation": "...", "why other options are wrong": { "Option text": "reason" } }
 *   2. A plain text string
 *
 * When structured, renders the general explanation followed by a labelled list
 * of wrong-option reasons with option letters derived from the `options` array.
 */
import React from 'react';

interface ExplanationDisplayProps {
  /** Raw explanation value — either a JSON string or plain text */
  text: string;
  /** The question's answer options array, used to map wrong-option keys to letters */
  options?: string[];
  /** Tailwind text colour class applied to all text (default: text-slate-700) */
  textClassName?: string;
  /** Tailwind text colour class applied to the heading (default: text-slate-800) */
  headingClassName?: string;
  /** Tailwind text colour class applied to option letters (default: text-slate-500) */
  labelClassName?: string;
}

export default function ExplanationDisplay({
  text,
  options,
  textClassName = 'text-slate-700',
  headingClassName = 'text-slate-800',
  labelClassName = 'text-slate-500',
}: ExplanationDisplayProps) {
  if (!text) return null;

  // Try to parse as structured JSON explanation
  let parsed: {
    'general explanation'?: string;
    'why other options are wrong'?: Record<string, string>;
  } | null = null;

  try {
    const candidate = JSON.parse(text);
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      parsed = candidate;
    }
  } catch {
    // Not JSON — fall through to plain text
  }

  if (parsed) {
    const generalExplanation = parsed['general explanation'] ?? '';
    const wrongOptions = parsed['why other options are wrong'] ?? {};
    const wrongEntries = Object.entries(wrongOptions);

    return (
      <div className={`space-y-2 text-sm leading-relaxed ${textClassName}`}>
        {generalExplanation && <p>{generalExplanation}</p>}
        {wrongEntries.length > 0 && (
          <div className="space-y-1.5">
            <p className={`font-bold ${headingClassName}`}>Why other options are wrong:</p>
            <ul className="space-y-1">
              {wrongEntries.map(([optionText, reason], i) => {
                const optionIndex =
                  options?.findIndex(
                    (o) => o.trim().toLowerCase() === optionText.trim().toLowerCase(),
                  ) ?? -1;
                const letter =
                  optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) + ')' : `${i + 1})`;
                return (
                  <li key={i} className="flex gap-2">
                    <span className={`font-bold shrink-0 ${labelClassName}`}>{letter}</span>
                    <span>
                      <span className={`font-semibold ${headingClassName}`}>{optionText}</span>
                      {' — '}
                      {reason}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Plain text fallback with basic markdown support (**bold**, _italic_)
  const lines = text.split('\n');
  return (
    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${textClassName}`}>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
        return (
          <React.Fragment key={i}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**'))
                return <strong key={j}>{part.slice(2, -2)}</strong>;
              if (part.startsWith('_') && part.endsWith('_'))
                return <em key={j}>{part.slice(1, -1)}</em>;
              return part;
            })}
            {i < lines.length - 1 && '\n'}
          </React.Fragment>
        );
      })}
    </p>
  );
}
