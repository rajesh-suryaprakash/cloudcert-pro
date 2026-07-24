import React from 'react';
import { CheckCircle, XCircle, AlertCircle, BookOpen } from 'lucide-react';
import ExplanationDisplay from '../../ui/ExplanationDisplay';

interface QuestionReviewData {
  id: string;
  questionText: string;
  options: string[];
  correctAnswers: string | string[];
  userAnswers: string[];
  isCorrect: boolean;
  explanation?: string;
  distractorExplanations?: Record<string, string>;
}

export interface QuestionReviewCardProps {
  question: QuestionReviewData;
  questionNumber: number;
}

export default function QuestionReviewCard({ question, questionNumber }: QuestionReviewCardProps) {
  const correctAnswersArray = Array.isArray(question.correctAnswers)
    ? question.correctAnswers
    : [question.correctAnswers];

  const getOptionStatus = (option: string, _index: number) => {
    const isUserAnswer = question.userAnswers.includes(option);
    const isCorrectAnswer = correctAnswersArray.includes(option);

    if (isCorrectAnswer && isUserAnswer) {
      return 'correct-selected';
    } else if (isCorrectAnswer && !isUserAnswer) {
      return 'correct-missed';
    } else if (!isCorrectAnswer && isUserAnswer) {
      return 'incorrect-selected';
    } else {
      return 'neutral';
    }
  };

  const getOptionIcon = (status: string) => {
    switch (status) {
      case 'correct-selected':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'correct-missed':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'incorrect-selected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getOptionStyles = (status: string) => {
    switch (status) {
      case 'correct-selected':
        return 'bg-emerald-50 border-emerald-300 text-emerald-900';
      case 'correct-missed':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800 border-dashed';
      case 'incorrect-selected':
        return 'bg-red-50 border-red-300 text-red-900';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const getExplanationForOption = (option: string, _index: number) => {
    const isCorrectAnswer = correctAnswersArray.includes(option);
    const isUserAnswer = question.userAnswers.includes(option);

    // Always show explanation for the correct answer
    if (isCorrectAnswer && question.explanation) {
      return question.explanation;
    }

    // Show distractor explanation only for options the user actually selected
    if (!isCorrectAnswer && isUserAnswer && question.distractorExplanations?.[option]) {
      return question.distractorExplanations[option];
    }

    // Generic fallback only for options the user selected — but suppress it if the
    // correct answer's structured explanation already covers this option in its
    // "why other options are wrong" section (avoids redundant boxes)
    if (!isCorrectAnswer && isUserAnswer) {
      // Check if the correct answer's explanation already covers this wrong option
      if (question.explanation) {
        try {
          const parsed = JSON.parse(question.explanation);
          const wrongOptions: Record<string, string> =
            parsed?.['why other options are wrong'] ??
            parsed?.['Why other options are wrong'] ??
            {};
          const alreadyCovered = Object.keys(wrongOptions).some(
            (key) => key.trim().toLowerCase() === option.trim().toLowerCase(),
          );
          if (alreadyCovered) return null; // already shown in the correct answer's explanation box
        } catch {
          // not JSON — fall through to generic fallback
        }
      }
      return `This option is incorrect. The correct answer${correctAnswersArray.length > 1 ? 's are' : ' is'}: ${correctAnswersArray.join(', ')}.`;
    }

    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
              question.isCorrect ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {questionNumber}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {question.isCorrect ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span
                className={`text-sm font-bold ${
                  question.isCorrect ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {question.isCorrect ? 'Correct' : 'Incorrect'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Question Text */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 mb-2">Question</p>
            <p className="text-slate-900 leading-relaxed">{question.questionText}</p>
          </div>
        </div>
      </div>

      {/* Answer Options */}
      <div className="space-y-3">
        <p className="text-sm font-bold text-slate-700">Answer Options</p>
        <div className="space-y-2">
          {question.options.map((option, index) => {
            const status = getOptionStatus(option, index);
            // Only show inline explanation for correct-selected and incorrect-selected
            // correct-missed explanations are shown in the summary card below
            const explanation =
              status === 'correct-missed' ? null : getExplanationForOption(option, index);

            return (
              <div key={index} className="space-y-2">
                {/* Option */}
                <div
                  className={`p-3 rounded-lg border-2 flex items-start gap-3 ${getOptionStyles(status)}`}
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white border-2 border-current flex items-center justify-center text-xs font-bold">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <div className="flex-1 flex items-start justify-between gap-3">
                    <p className="text-sm leading-relaxed">{option}</p>
                    {getOptionIcon(status)}
                  </div>
                </div>

                {/* Inline explanation for correct-selected and incorrect-selected only */}
                {explanation && (
                  <div
                    className={`ml-9 p-3 rounded-lg border ${
                      correctAnswersArray.includes(option)
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          correctAnswersArray.includes(option)
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      />
                      <div className="flex-1">
                        <p
                          className={`text-xs font-bold mb-1 ${
                            correctAnswersArray.includes(option)
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {correctAnswersArray.includes(option)
                            ? 'Why this is correct:'
                            : 'Why this is incorrect:'}
                        </p>
                        <ExplanationDisplay
                          text={explanation}
                          options={question.options}
                          textClassName={
                            correctAnswersArray.includes(option)
                              ? 'text-emerald-800'
                              : 'text-amber-800'
                          }
                          headingClassName={
                            correctAnswersArray.includes(option)
                              ? 'text-emerald-900'
                              : 'text-amber-900'
                          }
                          labelClassName={
                            correctAnswersArray.includes(option)
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Correct answers you missed — shown as a summary card at the bottom */}
      {question.options.some((opt) => getOptionStatus(opt, 0) === 'correct-missed') && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-start gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
              Correct answer
              {question.options.filter((opt) => getOptionStatus(opt, 0) === 'correct-missed')
                .length > 1
                ? 's'
                : ''}{' '}
              you missed
            </p>
          </div>
          <div className="space-y-3">
            {question.options
              .map((opt, idx) => ({ opt, idx, status: getOptionStatus(opt, idx) }))
              .filter(({ status }) => status === 'correct-missed')
              .map(({ opt, idx }) => {
                const explanation = getExplanationForOption(opt, idx);
                return (
                  <div key={idx}>
                    <p className="text-sm font-semibold text-emerald-900 mb-1">
                      {String.fromCharCode(65 + idx)}) {opt}
                    </p>
                    {explanation && (
                      <ExplanationDisplay
                        text={explanation}
                        options={question.options}
                        textClassName="text-emerald-800"
                        headingClassName="text-emerald-900"
                        labelClassName="text-emerald-700"
                      />
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-slate-50 rounded-xl p-4">
        <p className="text-xs font-bold text-slate-600 mb-3">Legend</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-700">Correct answer</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-slate-700">Your incorrect choice</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-emerald-200 border-dashed rounded" />
            <span className="text-slate-700">Correct answer you missed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
