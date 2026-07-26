import React from 'react';
import { Clock, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { type Difficulty } from '../../../hooks/customQuizUtils';
import type { HistoricalAttempt } from '../../../types';

export interface ExamHistoryTableProps {
  attempts: HistoricalAttempt[];
  onViewAttempt: (attempt: HistoricalAttempt) => void;
  getDifficulty: (attempt: HistoricalAttempt) => Difficulty;
}

export function ExamHistoryTable({
  attempts,
  onViewAttempt,
  getDifficulty,
}: ExamHistoryTableProps) {
  if (attempts.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" /> My Exam History
        </h3>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 text-center space-y-3">
            <Trophy className="w-8 h-8 text-slate-200 mx-auto" />
            <p className="font-bold text-slate-900 text-sm">No attempts yet</p>
            <p className="text-xs text-slate-400">Your practice history will appear here.</p>
          </div>
        </div>
      </div>
    );
  }

  const displayed = attempts.slice(0, 8);
  const counters: Record<string, number> = {};
  const allReversed = [...attempts].reverse();
  const iterMap = new Map<string, number>();

  allReversed.forEach((a: HistoricalAttempt) => {
    const name = a.sessionName ?? a.examName ?? 'Exam Attempt';
    counters[name] = (counters[name] || 0) + 1;
    iterMap.set(a.id, counters[name]);
  });

  const difficultyColors = {
    Easy: 'bg-emerald-100 text-emerald-700',
    Medium: 'bg-amber-100 text-amber-700',
    Hard: 'bg-rose-100 text-rose-700',
    Mixed: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <Clock className="w-4 h-4 text-indigo-600" /> My Exam History
      </h3>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Exam Name
                </th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Difficulty
                </th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Questions
                </th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Correct
                </th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Wrong
                </th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayed.map((attempt: HistoricalAttempt, i: number) => {
                const baseName = attempt.sessionName ?? attempt.examName ?? 'Exam Attempt';
                const iter = iterMap.get(attempt.id) ?? 1;
                const totalForName = counters[baseName] ?? 1;
                const displayName = totalForName > 1 ? `${baseName} #${iter}` : baseName;
                const difficulty = getDifficulty(attempt);

                return (
                  <motion.tr
                    key={attempt.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => onViewAttempt(attempt)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                          {displayName}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                          <Clock className="w-3 h-3" />
                          {new Date(attempt.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${difficultyColors[difficulty]}`}
                      >
                        {difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-slate-700">
                        {attempt.totalQuestions ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-emerald-600">
                        {attempt.correctAnswers ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-rose-500">
                        {attempt.incorrectAnswers ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {attempt.status === 'in_progress' || attempt.status === 'paused' ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                          {attempt.status === 'paused' ? 'Paused' : 'In Progress'}
                        </span>
                      ) : (
                        <span className="text-lg font-black text-indigo-600">
                          {Math.round(attempt.score || 0)}%
                        </span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
