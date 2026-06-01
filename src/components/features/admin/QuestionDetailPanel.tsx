/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../../../api/client';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Bold,
  Italic,
  List,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchCertifications } from '../../../api/certifications';
import { useAdminNavigation } from '../../../hooks/useAdminNavigation';
import { useKeyboardNavigation } from '../../../hooks/useKeyboardNavigation';
import NavigationControls from './NavigationControls';
import ExplanationDisplay from '../../ui/ExplanationDisplay';

interface QuestionDetailPanelProps {
  questionId: string;
  onEdit: (question: any) => void;
  onDelete: (questionId: string) => void;
  onBack: (certId?: string, topicId?: string, subTopicId?: string) => void;
}

// ── Minimal rich-text toolbar (bold, italic, bullet list) ──────────────────
function RichTextToolbar({ targetRef }: { targetRef: React.RefObject<HTMLTextAreaElement> }) {
  const wrap = (before: string, after: string) => {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end);
    const replacement = before + (selected || 'text') + after;
    const newVal = el.value.slice(0, start) + replacement + el.value.slice(end);
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(el, newVal);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    el.setSelectionRange(
      start + before.length,
      start + before.length + (selected || 'text').length,
    );
  };

  const insertBullet = () => {
    const el = targetRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos);
    const after = el.value.slice(pos);
    const prefix = before.length === 0 || before.endsWith('\n') ? '' : '\n';
    const newVal = before + prefix + '• ' + after;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    nativeInputValueSetter?.call(el, newVal);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    el.setSelectionRange(pos + prefix.length + 2, pos + prefix.length + 2);
  };

  return (
    <div className="flex gap-1 mb-1">
      <button
        type="button"
        onClick={() => wrap('**', '**')}
        className="px-2 py-1 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        title="Bold"
      >
        <Bold className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={() => wrap('_', '_')}
        className="px-2 py-1 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        title="Italic"
      >
        <Italic className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={insertBullet}
        className="px-2 py-1 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        title="Bullet point"
      >
        <List className="w-3 h-3" />
      </button>
      <span className="text-[10px] text-slate-400 self-center ml-1">
        supports **bold**, _italic_, • bullets
      </span>
    </div>
  );
}

// ── Convert structured explanation JSON to human-readable edit text ────────
function explanationToEditText(raw: string, options?: string[]): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw;

    const general = parsed['general explanation'] ?? '';
    const wrongOptions: Record<string, string> = parsed['why other options are wrong'] ?? {};
    const wrongEntries = Object.entries(wrongOptions);

    let result = general;

    if (wrongEntries.length > 0) {
      result += '\n\nWhy other options are wrong:\n';
      wrongEntries.forEach(([optionText, reason], i) => {
        const optionIndex = options?.findIndex(
          (o) => o.trim().toLowerCase() === optionText.trim().toLowerCase(),
        ) ?? -1;
        const letter = optionIndex >= 0 ? String.fromCharCode(65 + optionIndex) + ')' : `${i + 1})`;
        result += `${letter} ${optionText} — ${reason}\n`;
      });
    }

    return result.trim();
  } catch {
    return raw;
  }
}

// ── Simple markdown-like renderer for explanation display ──────────────────
// (Imported from shared component: src/components/ui/ExplanationDisplay.tsx)

export default function QuestionDetailPanel({
  questionId,
  onEdit: _onEdit,
  onDelete,
  onBack,
}: QuestionDetailPanelProps) {
  const [searchParams] = useSearchParams();
  const [question, setQuestion] = useState<any>(null);
  const [allCerts, setAllCerts] = useState<any[]>([]);
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [allSubTopics, setAllSubTopics] = useState<any[]>([]);
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const explanationRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Initialize navigation hook with error handling
  const navigation = useAdminNavigation('questions', questionId, {
    onNavigationError: (error, message) => {
      showToast('error', message);
    },
  });

  // Setup keyboard navigation (disabled during edit mode, modal, or single record)
  useKeyboardNavigation({
    onPrevious: navigation.goPrevious,
    onNext: navigation.goNext,
    enabled: !showEditForm && !showDeleteConfirm,
    isSingleRecord: navigation.total === 1,
  });

  useEffect(() => {
    setShowEditForm(false);

    // Check if we have cached data for optimistic display
    const cached = navigation.getCachedData(questionId);
    if (cached) {
      setQuestion(cached.question);
      setAllCerts(cached.allCerts || []);
      setAllTopics(cached.allTopics || []);
      setAllSubTopics(cached.allSubTopics || []);
      setAllUnits(cached.allUnits || []);
      // Still fetch fresh data in background
      fetchQuestionDetails();
    } else {
      // No cache, fetch normally
      fetchQuestionDetails();
    }
    // fetchQuestionDetails and navigation are defined inside the component and would cause infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const fetchQuestionDetails = async () => {
    setLoading(true);
    try {
      // Load all certs, topics, and subtopics to find the question
      const certs = await fetchCertifications();
      setAllCerts(certs);

      let foundQuestion: any = null;
      const topicsData: any[] = [];
      const subTopicsData: any[] = [];

      let foundUnits: any[] = [];

      for (const cert of certs) {
        const topics = await fetchApi(`/certifications/${cert.id}/topics`);
        const enrichedTopics = topics.map((t: any) => ({
          ...t,
          _certTitle: cert.title,
          _certId: cert.id,
        }));
        topicsData.push(...enrichedTopics);

        for (const topic of enrichedTopics) {
          const subtopics = await fetchApi(`/topics/${topic.id}/subtopics`);
          const enrichedSubtopics = subtopics.map((s: any) => ({
            ...s,
            _topicTitle: topic.title,
            _topicId: topic.id,
            _certTitle: cert.title,
            _certId: cert.id,
          }));
          subTopicsData.push(...enrichedSubtopics);

          for (const subtopic of enrichedSubtopics) {
            const questions = await fetchApi(`/subtopics/${subtopic.id}/questions`);
            const match = questions.find((q: any) => q.id === questionId);
            if (match) {
              // Fetch units for this subtopic to resolve unit title
              let unitTitle: string | undefined;
              let unitsForSubtopic: any[] = [];
              try {
                unitsForSubtopic = await fetchApi(`/subtopics/${subtopic.id}/units`);
                if (match.unitId) {
                  const unit = unitsForSubtopic.find((u: any) => u.id === match.unitId);
                  unitTitle = unit?.title;
                }
              } catch {
                // units fetch failure is non-fatal
              }
              setAllUnits(unitsForSubtopic);
              foundUnits = unitsForSubtopic;
              foundQuestion = {
                ...match,
                _subTopicTitle: subtopic.title,
                _subTopicId: subtopic.id,
                _topicTitle: topic.title,
                _topicId: topic.id,
                _certTitle: cert.title,
                _certId: cert.id,
                _unitTitle: unitTitle,
              };
              break;
            }
          }
          if (foundQuestion) break;
        }
        if (foundQuestion) break;
      }

      setAllTopics(topicsData);
      setAllSubTopics(subTopicsData);

      if (!foundQuestion) {
        setQuestion(null);
        setLoading(false);
        return;
      }

      setQuestion(foundQuestion);

      // Cache the data for optimistic navigation
      navigation.cacheCurrentData({
        question: foundQuestion,
        allCerts: certs,
        allTopics: topicsData,
        allSubTopics: subTopicsData,
        allUnits: foundUnits,
      });

      // If navigated with ?edit=true, open edit form immediately
      if (searchParams.get('edit') === 'true') {
        setEditForm({
          certId: foundQuestion._certId || '',
          topicId: foundQuestion._topicId || '',
          subTopicId: foundQuestion._subTopicId || '',
          unitId: foundQuestion.unitId || '',
          questionText: foundQuestion.questionText || '',
          questionType: foundQuestion.questionType || 'single',
          options: Array.isArray(foundQuestion.options) ? foundQuestion.options : ['', '', '', ''],
          correctAnswers: Array.isArray(foundQuestion.correctAnswers)
            ? foundQuestion.questionType === 'single'
              ? (foundQuestion.correctAnswers[0] ?? '')
              : foundQuestion.correctAnswers
            : (foundQuestion.correctAnswers ?? ''),
          explanation: explanationToEditText(foundQuestion.explanation || '', Array.isArray(foundQuestion.options) ? foundQuestion.options : []),
          difficulty: foundQuestion.difficulty || 'Medium',
          tags: Array.isArray(foundQuestion.tags) ? foundQuestion.tags : [],
          points: foundQuestion.points || 1,
          isActive: foundQuestion.isActive !== false,
        });
        setShowEditForm(true);
      }
    } catch (error) {
      console.error('Failed to fetch question details:', error);
      showToast('error', 'Failed to load question details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setEditForm({
      certId: question._certId || '',
      topicId: question._topicId || '',
      subTopicId: question._subTopicId || '',
      unitId: question.unitId || '',
      questionText: question.questionText || '',
      questionType: question.questionType || 'single',
      options: Array.isArray(question.options) ? question.options : ['', '', '', ''],
      correctAnswers: Array.isArray(question.correctAnswers)
        ? question.questionType === 'single'
          ? (question.correctAnswers[0] ?? '')
          : question.correctAnswers
        : (question.correctAnswers ?? ''),
      explanation: explanationToEditText(question.explanation || '', Array.isArray(question.options) ? question.options : []),
      difficulty: question.difficulty || 'Medium',
      tags: Array.isArray(question.tags) ? question.tags : [],
      points: question.points || 1,
      isActive: question.isActive !== false,
    });
    setShowEditForm(true);
  };

  const handleCancelEdit = () => {
    setShowEditForm(false);
    setEditForm({});
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchApi(`/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editForm,
          unitId: editForm.unitId || null,
        }),
      });
      showToast('success', 'Question updated successfully');
      setShowEditForm(false);
      await fetchQuestionDetails();
    } catch (error) {
      console.error('Failed to update question:', error);
      showToast('error', 'Failed to update question');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(questionId);
      showToast('success', 'Question deleted successfully');
      setTimeout(() => onBack(question?._certId, question?._topicId, question?._subTopicId), 1500);
    } catch (error: any) {
      showToast('error', error?.message ?? 'Failed to delete question');
    }
  };

  // Get filtered topics and subtopics for edit form
  const filteredTopics = allTopics.filter((t) => t._certId === editForm.certId);
  const filteredSubTopics = allSubTopics.filter((s) => s._topicId === editForm.topicId);

  // Load units for the edit form whenever the subtopic changes
  useEffect(() => {
    if (!showEditForm) return;
    if (!editForm.subTopicId) {
      setAllUnits([]);
      return;
    }
    fetchApi(`/subtopics/${editForm.subTopicId}/units`)
      .then((data: any) => setAllUnits(Array.isArray(data) ? data : []))
      .catch(() => setAllUnits([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm.subTopicId, showEditForm]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-400 font-bold animate-pulse">Loading question details...</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Question Not Found</h3>
        <p className="text-slate-500 mb-6">The requested question could not be found.</p>
        <button
          onClick={() => onBack()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Questions
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-rose-100 rounded-2xl">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Delete Question?</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this question? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => onBack(question?._certId, question?._topicId, question?._subTopicId)}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Questions
        </button>
        <div className="flex items-center gap-2">
          {showEditForm ? (
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          ) : (
            <>
              <button
                onClick={handleEditClick}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-100 transition-all"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      {navigation.context && (
        <div className="mb-6">
          <NavigationControls
            currentIndex={navigation.currentIndex}
            total={navigation.total}
            canGoPrevious={navigation.canGoPrevious}
            canGoNext={navigation.canGoNext}
            onPrevious={navigation.goPrevious}
            onNext={navigation.goNext}
            isLoading={navigation.isLoading}
          />
        </div>
      )}

      <h2 className="text-2xl font-black text-slate-900 mb-6">
        {showEditForm ? 'Edit Question' : 'Question Details'}
      </h2>

      {/* Read-Only View */}
      {!showEditForm && (
        <motion.div
          key={questionId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Context Info */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">
              Context
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Certification
                </label>
                <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                  {question._certTitle || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Topic
                </label>
                <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                  {question._topicTitle || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Sub Topic
                </label>
                <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                  {question._subTopicTitle || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Unit
                </label>
                <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                  {question._unitTitle || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">
              Question
            </h3>
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Question Text
                </label>
                <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium min-h-[80px]">
                  {question.questionText}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Question Type
                  </label>
                  <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium capitalize">
                    {question.questionType === 'single' ? 'Single Choice' : 'Multiple Choice'}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Difficulty
                  </label>
                  <div
                    className={`w-full p-3 rounded-xl border border-slate-200 bg-white font-medium ${
                      question.difficulty === 'Easy'
                        ? 'text-emerald-600'
                        : question.difficulty === 'Hard'
                          ? 'text-rose-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {question.difficulty}
                  </div>
                </div>
              </div>

              {/* Answer Options */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Answer Options
                </label>
                <div className="space-y-2">
                  {(question.options || []).map((opt: string, i: number) => {
                    const letter = String.fromCharCode(65 + i);
                    const isCorrect = Array.isArray(question.correctAnswers)
                      ? question.correctAnswers.includes(opt)
                      : question.correctAnswers === opt;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          isCorrect
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-400 w-5 shrink-0">
                          {letter}.
                        </span>
                        <span className="flex-1 text-sm text-slate-900 font-medium">{opt}</span>
                        {isCorrect && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Explanation
                </label>
                <div className="w-full p-3 rounded-xl border border-slate-200 bg-white min-h-[80px]">
                  <ExplanationDisplay text={question.explanation || 'No explanation provided.'} options={question.options} />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {(question.tags || []).length > 0 ? (
                    question.tags.map((tag: string, i: number) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 text-sm">No tags</span>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Points
                  </label>
                  <div className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-medium">
                    {question.points || 1}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Status
                  </label>
                  <div
                    className={`w-full p-3 rounded-xl border border-slate-200 bg-white font-medium ${
                      question.isActive !== false ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {question.isActive !== false ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Edit Form */}
      {showEditForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Context Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Certification
                </label>
                <select
                  value={editForm.certId}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      certId: e.target.value,
                      topicId: '',
                      subTopicId: '',
                      unitId: '',
                    })
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  required
                >
                  <option value="">Select certification...</option>
                  {allCerts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Topic
                </label>
                <select
                  value={editForm.topicId}
                  onChange={(e) =>
                    setEditForm({ ...editForm, topicId: e.target.value, subTopicId: '', unitId: '' })
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  required
                >
                  <option value="">Select topic...</option>
                  {filteredTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Sub Topic
                </label>
                <select
                  value={editForm.subTopicId}
                  onChange={(e) => setEditForm({ ...editForm, subTopicId: e.target.value, unitId: '' })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white"
                  required
                >
                  <option value="">Select sub topic...</option>
                  {filteredSubTopics.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Unit
                </label>
                <select
                  value={editForm.unitId || ''}
                  onChange={(e) => setEditForm({ ...editForm, unitId: e.target.value })}
                  disabled={allUnits.length === 0}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {editForm.subTopicId ? 'Select unit (optional)...' : 'Select sub topic first'}
                  </option>
                  {allUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Question Text */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Question Text
              </label>
              <textarea
                value={editForm.questionText}
                onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 h-24"
                placeholder="Enter the question (min 10 chars)..."
                required
              />
            </div>

            {/* Question Type and Difficulty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Question Type
                </label>
                <select
                  value={editForm.questionType}
                  onChange={(e) => {
                    const type = e.target.value as 'single' | 'multiple';
                    setEditForm({
                      ...editForm,
                      questionType: type,
                      correctAnswers: type === 'single' ? '' : [],
                    });
                  }}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                >
                  <option value="single">Single Choice</option>
                  <option value="multiple">Multiple Choice</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Difficulty
                </label>
                <select
                  value={editForm.difficulty}
                  onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value as any })}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Answer Options */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Answer Options
                  <span className="ml-2 normal-case font-normal text-slate-400">
                    (
                    {editForm.questionType === 'single'
                      ? 'select correct with radio'
                      : 'check all correct'}
                    )
                  </span>
                </label>
              </div>
              <div className="space-y-2">
                {editForm.options.map((opt: string, i: number) => {
                  const letter = String.fromCharCode(65 + i);
                  const isSingle = editForm.questionType === 'single';
                  const isChecked = isSingle
                    ? editForm.correctAnswers === opt && opt !== ''
                    : (editForm.correctAnswers as string[]).includes(opt);

                  return (
                    <div key={i} className="flex items-center gap-3">
                      <input
                        type={isSingle ? 'radio' : 'checkbox'}
                        name="correctAnswer"
                        checked={isChecked}
                        onChange={() => {
                          if (isSingle) {
                            setEditForm({ ...editForm, correctAnswers: opt });
                          } else {
                            const current = [...(editForm.correctAnswers as string[])];
                            if (current.includes(opt)) {
                              setEditForm({
                                ...editForm,
                                correctAnswers: current.filter((c) => c !== opt),
                              });
                            } else {
                              setEditForm({ ...editForm, correctAnswers: [...current, opt] });
                            }
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 shrink-0"
                        title={isSingle ? 'Mark as correct answer' : 'Mark as correct'}
                      />
                      <span className="text-xs font-bold text-slate-400 w-5 shrink-0">
                        {letter}.
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...editForm.options];
                          const oldVal = newOpts[i];
                          newOpts[i] = e.target.value;
                          if (isSingle && editForm.correctAnswers === oldVal) {
                            setEditForm({
                              ...editForm,
                              options: newOpts,
                              correctAnswers: e.target.value,
                            });
                          } else if (!isSingle) {
                            const ca = (editForm.correctAnswers as string[]).map((c) =>
                              c === oldVal ? e.target.value : c,
                            );
                            setEditForm({ ...editForm, options: newOpts, correctAnswers: ca });
                          } else {
                            setEditForm({ ...editForm, options: newOpts });
                          }
                        }}
                        className="flex-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 text-sm"
                        placeholder={`Option ${letter}`}
                        required
                      />
                      {editForm.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = editForm.options.filter(
                              (_: any, idx: number) => idx !== i,
                            );
                            const removed = editForm.options[i];
                            let newCA = editForm.correctAnswers;
                            if (isSingle && newCA === removed) newCA = '';
                            else if (!isSingle)
                              newCA = (newCA as string[]).filter((c) => c !== removed);
                            setEditForm({ ...editForm, options: newOpts, correctAnswers: newCA });
                          }}
                          className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {editForm.options.length < 5 && (
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, options: [...editForm.options, ''] })}
                  className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
                >
                  <Plus className="w-4 h-4" /> Add Option
                </button>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={editForm.tags.join(', ')}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter((t) => t !== ''),
                  })
                }
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                placeholder="vpc, networking, security"
              />
            </div>

            {/* Explanation */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                Explanation
              </label>
              <RichTextToolbar targetRef={explanationRef} />
              <textarea
                ref={explanationRef}
                value={editForm.explanation}
                onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 h-28 font-mono text-sm"
                placeholder="Explain why the answer is correct..."
                required
              />
            </div>

            {/* Points and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Points
                </label>
                <input
                  type="number"
                  value={editForm.points}
                  onChange={(e) => setEditForm({ ...editForm, points: e.target.value === '' ? '' : parseInt(e.target.value) })}
                  onBlur={(e) => { const v = parseInt(e.target.value); setEditForm({ ...editForm, points: isNaN(v) ? 1 : Math.min(10, Math.max(1, v)) }); }}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                  min="1"
                  max="10"
                  required
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-sm font-bold text-slate-600">
                    Active (visible to learners)
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Question'}
            </button>
          </form>
        </motion.div>
      )}
    </>
  );
}
