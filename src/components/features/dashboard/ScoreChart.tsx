import React from 'react';
import type { HistoricalAttempt } from '../../../types';

export function ScoreChart({ attempts }: { attempts: HistoricalAttempt[] }) {
  const W = 600,
    H = 160,
    PAD = 32;
  const scores = attempts.map((a) => Math.round(a.score || 0));
  const min = Math.max(0, Math.min(...scores) - 10);
  const max = Math.min(100, Math.max(...scores) + 10);
  const xStep = (W - PAD * 2) / Math.max(scores.length - 1, 1);
  const yScale = (s: number) => H - PAD - ((s - min) / (max - min || 1)) * (H - PAD * 2);
  const points = scores.map((s, i) => `${PAD + i * xStep},${yScale(s)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Score history chart">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line
            x1={PAD}
            x2={W - PAD}
            y1={yScale(v)}
            y2={yScale(v)}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <text
            x={PAD - 8}
            y={yScale(v)}
            textAnchor="end"
            fontSize="10"
            fill="#94a3b8"
            dominantBaseline="middle"
          >
            {v}%
          </text>
        </g>
      ))}
      <polyline
        fill="none"
        stroke="#6366f1"
        strokeWidth="2.5"
        strokeLinejoin="round"
        points={points}
      />
      {scores.map((s, i) => (
        <g key={i}>
          <circle cx={PAD + i * xStep} cy={yScale(s)} r="5" fill="#6366f1" />
          <text
            x={PAD + i * xStep}
            y={yScale(s) - 10}
            textAnchor="middle"
            fontSize="10"
            fontWeight="bold"
            fill="#6366f1"
          >
            {s}%
          </text>
          <text x={PAD + i * xStep} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {new Date(attempts[i].createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </text>
        </g>
      ))}
    </svg>
  );
}
