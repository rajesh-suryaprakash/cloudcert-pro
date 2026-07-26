import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { type Difficulty } from '../../../hooks/customQuizUtils';
import type { ExamConfiguration } from '../../../types';
import type { ClampedInputResult } from '../../../hooks/useClampedInput';

export type TestType = 'mock' | 'practice';

export interface QuizWizardProps {
  examToStart: ExamConfiguration;
  sessionConfig: {
    testType: TestType;
    difficulty: Difficulty;
    numQuestions: number;
    duration: number;
    passingScore: number;
  };
  setSessionConfig: React.Dispatch<
    React.SetStateAction<{
      testType: TestType;
      difficulty: Difficulty;
      numQuestions: number;
      duration: number;
      passingScore: number;
    }>
  >;
  sessionStarting: boolean;
  sessionError: string | null;
  sessionNumQuestionsInput: ClampedInputResult;
  sessionDurationInput: ClampedInputResult;
  sessionPassingScoreInput: ClampedInputResult;
  onCancel: () => void;
  onStart: () => Promise<void>;
}

export function QuizWizard({
  examToStart,
  sessionConfig,
  setSessionConfig,
  sessionStarting,
  sessionError,
  sessionNumQuestionsInput,
  sessionDurationInput,
  sessionPassingScoreInput,
  onCancel,
  onStart,
}: QuizWizardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-4"
      >
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white rounded-t-3xl">
          <h3 className="text-xl font-black">{examToStart.name}</h3>
          <p className="text-indigo-200 text-sm mt-1">Configure your session before starting</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Test Type -- Mock and Practice only */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Test Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'mock', label: 'Mock Test', sub: 'Timed' },
                  { value: 'practice', label: 'Practice Test', sub: 'Untimed' },
                ] as { value: TestType; label: string; sub: string }[]
              ).map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setSessionConfig((prev) => ({
                      ...prev,
                      testType: t.value,
                    }));
                  }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    sessionConfig.testType === t.value
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <p
                    className={`font-bold text-sm ${
                      sessionConfig.testType === t.value ? 'text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    {t.label}
                  </p>
                  <p className="text-xs text-slate-400">{t.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Filter -- hidden for difficulty_balanced strategy */}
          {examToStart.questionSelectionStrategy === 'difficulty_balanced' ? (
            <div className="space-y-2 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">
                    Difficulty Balanced Strategy
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    This exam automatically distributes questions proportionally across Easy,
                    Medium, and Hard levels. No difficulty filter is needed.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Difficulty Filter (Optional)
              </label>
              <div className="flex gap-2 flex-wrap">
                {(['Easy', 'Medium', 'Hard', 'Mixed'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSessionConfig((prev) => ({ ...prev, difficulty: d }))}
                    className={`px-4 py-2 rounded-xl font-bold text-sm border-2 transition-all ${
                      sessionConfig.difficulty === d
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 px-1">
                Leave as "Mixed" to include all difficulty levels
              </p>
            </div>
          )}

          {/* Number of Questions */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Number of Questions{' '}
              <span className="normal-case font-normal text-slate-400">(5-60)</span>
            </label>
            <input
              type="number"
              min={5}
              max={60}
              {...sessionNumQuestionsInput.inputProps}
              className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-slate-900 font-bold"
            />
          </div>

          {/* Duration -- hidden for practice/untimed */}
          {sessionConfig.testType !== 'practice' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Session Duration (minutes){' '}
                <span className="normal-case font-normal text-slate-400">(5-120)</span>
              </label>
              <input
                type="number"
                min={5}
                max={120}
                {...sessionDurationInput.inputProps}
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-slate-900 font-bold"
              />
            </div>
          )}

          {/* Passing Score */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Passing Score (%){' '}
              <span className="normal-case font-normal text-slate-400">(70-100)</span>
            </label>
            <input
              type="number"
              min={70}
              max={100}
              {...sessionPassingScoreInput.inputProps}
              className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-slate-900 font-bold"
            />
          </div>

          {/* Error message */}
          {sessionError && (
            <p className="text-sm font-bold text-rose-600 flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {sessionError}
            </p>
          )}

          {/* Cancel + Start Session buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={sessionStarting}
              onClick={onStart}
              className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-60"
            >
              {sessionStarting ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
