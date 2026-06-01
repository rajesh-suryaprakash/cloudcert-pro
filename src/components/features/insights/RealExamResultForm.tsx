import React, { useState } from 'react';
import { CheckCircle, XCircle, Calendar, AlertCircle } from 'lucide-react';
import { fetchApi } from '../../../api/client';

interface RealExamResultFormProps {
  certificationId: string;
  certificationTitle: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function RealExamResultForm({
  certificationId,
  certificationTitle,
  onSuccess,
  onCancel,
}: RealExamResultFormProps) {
  const [passed, setPassed] = useState<boolean | null>(null);
  const [examDate, setExamDate] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passed === null) {
      setError('Please select whether you passed or failed');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await fetchApi('/insights/real-exam-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificationId,
          passed,
          examDate: examDate || undefined,
        }),
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit exam result');
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h4 className="text-xl font-bold text-slate-900">Thank you!</h4>
          <p className="text-sm text-slate-600">
            Your exam result has been recorded successfully.
            {passed && (
              <span className="block mt-2 text-emerald-600 font-bold">
                Congratulations on passing! 🎉
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Certification Info */}
      <div className="bg-slate-50 rounded-xl p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
          Certification
        </p>
        <p className="text-sm font-bold text-slate-900">{certificationTitle}</p>
      </div>

      {/* Pass/Fail Selection */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-700">
          Did you pass the real certification exam? *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setPassed(true);
              setError(null);
            }}
            className={`p-4 rounded-xl border-2 transition-all ${
              passed === true
                ? 'border-emerald-600 bg-emerald-50'
                : 'border-slate-200 hover:border-emerald-300'
            }`}
          >
            <CheckCircle
              className={`w-8 h-8 mx-auto mb-2 ${
                passed === true ? 'text-emerald-600' : 'text-slate-400'
              }`}
            />
            <p
              className={`font-bold text-sm ${
                passed === true ? 'text-emerald-700' : 'text-slate-700'
              }`}
            >
              Passed
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPassed(false);
              setError(null);
            }}
            className={`p-4 rounded-xl border-2 transition-all ${
              passed === false
                ? 'border-rose-600 bg-rose-50'
                : 'border-slate-200 hover:border-rose-300'
            }`}
          >
            <XCircle
              className={`w-8 h-8 mx-auto mb-2 ${
                passed === false ? 'text-rose-600' : 'text-slate-400'
              }`}
            />
            <p
              className={`font-bold text-sm ${
                passed === false ? 'text-rose-700' : 'text-slate-700'
              }`}
            >
              Failed
            </p>
          </button>
        </div>
      </div>

      {/* Exam Date (Optional) */}
      <div className="space-y-2">
        <label
          htmlFor="examDate"
          className="text-sm font-bold text-slate-700 flex items-center gap-2"
        >
          <Calendar className="w-4 h-4 text-slate-400" />
          Exam Date (Optional)
        </label>
        <input
          type="date"
          id="examDate"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <p className="text-xs text-slate-500">When did you take the real certification exam?</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-900">Error</p>
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || passed === null}
          className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit Result'}
        </button>
      </div>
    </form>
  );
}
