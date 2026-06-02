/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../../../api/client';
import { fetchCertifications } from '../../../api/certifications';
import {
  Plus,
  Trash2,
  Loader2,
  X,
  Pencil,
  CheckCircle2,
  Bold,
  Italic,
  List,
  Search,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePagination, paginate } from '../../../hooks/usePagination';
import Pagination from '../../ui/Pagination';
import ExplanationDisplay from '../../ui/ExplanationDisplay';

const EMPTY_FORM = {
  questionText: '',
  questionType: 'single' as 'single' | 'multiple',
  options: ['', '', '', ''],
  correctAnswers: '' as string | string[],
  explanation: '',
  difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
  tags: [] as string[],
  points: 1,
  isActive: true,
};

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
    // Trigger React synthetic change
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

interface QuestionsPanelProps {
  onSelectQuestion?: (question: any, openEdit?: boolean, ids?: string[]) => void;
}

export default function QuestionsPanel({ onSelectQuestion }: QuestionsPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allCerts, setAllCerts] = useState<any[]>([]);
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [allSubTopics, setAllSubTopics] = useState<any[]>([]);
  const [allUnits, setAllUnits] = useState<any[]>([]);

  const activeCertId = searchParams.get('certId') ?? '';
  const activeTopicId = searchParams.get('topicId') ?? '';
  const activeSubTopicId = searchParams.get('subTopicId') ?? '';
  const activeUnitId = searchParams.get('unitId') ?? '';
  const activeCert = allCerts.find((c) => c.id === activeCertId) ?? null;
  const activeTopic = allTopics.find((t) => t.id === activeTopicId) ?? null;
  const activeSubTopic = allSubTopics.find((s) => s.id === activeSubTopicId) ?? null;
  const activeUnit = allUnits.find((u) => u.id === activeUnitId) ?? null;

  const setActiveCert = (cert: any) => {
    const p = new URLSearchParams(searchParams);
    if (cert) {
      p.set('certId', cert.id);
    } else {
      p.delete('certId');
    }
    p.delete('topicId');
    p.delete('subTopicId');
    p.delete('unitId');
    p.set('page', '1');
    setSearchParams(p, { replace: true });
  };
  const setActiveTopic = (topic: any) => {
    const p = new URLSearchParams(searchParams);
    if (topic) {
      p.set('topicId', topic.id);
    } else {
      p.delete('topicId');
    }
    p.delete('subTopicId');
    p.delete('unitId');
    p.set('page', '1');
    setSearchParams(p, { replace: true });
  };
  const setActiveSubTopic = (sub: any) => {
    const p = new URLSearchParams(searchParams);
    if (sub) {
      p.set('subTopicId', sub.id);
    } else {
      p.delete('subTopicId');
    }
    // Clear unit filter whenever subtopic changes or is cleared
    p.delete('unitId');
    p.set('page', '1');
    setSearchParams(p, { replace: true });
  };
  const setActiveUnit = (unit: any) => {
    const p = new URLSearchParams(searchParams);
    if (unit) {
      p.set('unitId', unit.id);
    } else {
      p.delete('unitId');
    }
    p.set('page', '1');
    setSearchParams(p, { replace: true });
  };
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterQuestionType, setFilterQuestionType] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Form-specific unit state (separate from the filter-bar unit state)
  const [formUnitId, setFormUnitId] = useState('');
  const [formUnits, setFormUnits] = useState<any[]>([]);
  const explanationRef = useRef<HTMLTextAreaElement>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000);
  }, []);

  // Load units for the "Add Question" form whenever the active subtopic changes
  const loadFormUnits = useCallback((subTopicId: string) => {
    if (!subTopicId) {
      setFormUnits([]);
      setFormUnitId('');
      return;
    }
    fetchApi(`/subtopics/${subTopicId}/units`)
      .then((data: any) => {
        const units = Array.isArray(data) ? data : [];
        setFormUnits(units);
        // Auto-select first unit if only one exists
        if (units.length === 1) setFormUnitId(units[0].id);
        else setFormUnitId('');
      })
      .catch(() => {
        setFormUnits([]);
        setFormUnitId('');
      });
  }, []);

  // Load all certs once
  useEffect(() => {
    fetchCertifications().then(setAllCerts).catch(console.error);
  }, []);

  // Load topics whenever cert filter changes
  useEffect(() => {
    if (allCerts.length === 0) return;
    const certsToFetch = activeCertId ? allCerts.filter((c) => c.id === activeCertId) : allCerts;
    if (certsToFetch.length === 0) return;
    Promise.all(
      certsToFetch.map((c) =>
        fetchApi(`/certifications/${c.id}/topics`)
          .then((data: any[]) => data.map((t) => ({ ...t, _certTitle: c.title, _certId: c.id })))
          .catch(() => []),
      ),
    ).then((results) => setAllTopics(results.flat()));
  }, [activeCertId, allCerts]);

  // Load subtopics whenever topic filter changes
  useEffect(() => {
    if (allTopics.length === 0) return;
    const topicsToFetch = activeTopicId
      ? allTopics.filter((t) => t.id === activeTopicId)
      : allTopics;
    if (topicsToFetch.length === 0) return;
    Promise.all(
      topicsToFetch.map((t) =>
        fetchApi(`/topics/${t.id}/subtopics`)
          .then((data: any[]) =>
            data.map((s) => ({
              ...s,
              _topicTitle: t.title,
              _topicId: t.id,
              _certTitle: t._certTitle,
              _certId: t._certId,
            })),
          )
          .catch(() => []),
      ),
    ).then((results) => setAllSubTopics(results.flat()));
  }, [activeTopicId, allTopics]);

  // Load units whenever subtopic filter changes
  useEffect(() => {
    if (!activeSubTopicId) {
      setAllUnits([]);
      return;
    }
    fetchApi(`/subtopics/${activeSubTopicId}/units`)
      .then((data: any) => setAllUnits(Array.isArray(data) ? data : []))
      .catch(() => setAllUnits([]));
  }, [activeSubTopicId]);

  // Attach _unitTitle to questions whenever allUnits or questions change
  useEffect(() => {
    if (allUnits.length === 0) return;
    setQuestions((prev) =>
      prev.map((q) => {
        if (!q.unitId) return q;
        const unit = allUnits.find((u: any) => u.id === q.unitId);
        return unit ? { ...q, _unitTitle: unit.title } : q;
      }),
    );
  }, [allUnits]);

  // Load questions whenever subtopic filter changes
  useEffect(() => {
    if (allSubTopics.length === 0) return;
    const subsToFetch = activeSubTopicId
      ? allSubTopics.filter((s) => s.id === activeSubTopicId)
      : allSubTopics;
    if (subsToFetch.length === 0) return;
    setLoading(true);
    Promise.all(
      subsToFetch.map((s) =>
        fetchApi(`/subtopics/${s.id}/questions`)
          .then((data: any[]) =>
            data.map((q) => ({
              ...q,
              _subTopicTitle: s.title,
              _subTopicId: s.id,
              _topicTitle: s._topicTitle,
              _certTitle: s._certTitle,
            })),
          )
          .catch(() => []),
      ),
    ).then((results) => {
      const flatQuestions = results.flat();
      // Attach unit titles from the loaded allUnits (best-effort; units may not be loaded yet)
      setQuestions(flatQuestions);
      setLoading(false);
    });
  }, [activeSubTopicId, allSubTopics]);

  const filteredTopics = useMemo(
    () => (activeCertId ? allTopics.filter((t) => t._certId === activeCertId) : allTopics),
    [allTopics, activeCertId],
  );

  const filteredSubTopics = useMemo(
    () =>
      activeTopicId
        ? allSubTopics.filter((s) => s._topicId === activeTopicId)
        : activeCertId
          ? allSubTopics.filter((s) => s._certId === activeCertId)
          : allSubTopics,
    [allSubTopics, activeTopicId, activeCertId],
  );

  // Units are already scoped to the selected subtopic via the API fetch
  const filteredUnits = allUnits;

  const openAdd = () => {
    setEditingId(null);
    setQuestionForm(EMPTY_FORM);
    setFormUnitId('');
    setFormUnits([]);
    // Pre-load units if a subtopic is already selected in the filter
    if (activeSubTopicId) loadFormUnits(activeSubTopicId);
    setShowAddForm(true);
  };

  /**
   * Build navigation context from current filter state and navigate to detail view
   * Encodes filtered IDs and filter state in URL for navigation support
   */
  const buildNavigationContextAndNavigate = (q: any, openEdit?: boolean) => {
    // Extract filtered question IDs from current filter state
    const ids = filtered.map((question) => question.id);

    // If onSelectQuestion handler is provided, use it for navigation
    if (onSelectQuestion) {
      onSelectQuestion(q, openEdit, ids);
      return;
    }

    // Fallback: open inline edit form (existing behavior)
    openEditInline(q);
  };

  const openEditInline = (q: any) => {
    setEditingId(q.id);
    setQuestionForm({
      questionText: q.questionText,
      questionType: q.questionType ?? 'single',
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswers: Array.isArray(q.correctAnswers)
        ? q.questionType === 'single'
          ? (q.correctAnswers[0] ?? '')
          : q.correctAnswers
        : (q.correctAnswers ?? ''),
      explanation: q.explanation ?? '',
      difficulty: q.difficulty ?? 'Medium',
      tags: Array.isArray(q.tags) ? q.tags : [],
      points: q.points ?? 1,
      isActive: q.isActive !== false,
    });
    // Set context for the form
    const sub = allSubTopics.find((s) => s.id === q._subTopicId);
    if (sub) {
      setActiveSubTopic(sub);
      loadFormUnits(sub.id);
      if (q.unitId) setFormUnitId(q.unitId);
      const topic = allTopics.find((t) => t.id === sub._topicId);
      if (topic) {
        setActiveTopic(topic);
        const cert = allCerts.find((c) => c.id === topic._certId);
        if (cert) setActiveCert(cert);
      }
    }
    setShowAddForm(true);
  };

  const openEdit = (q: any) => {
    buildNavigationContextAndNavigate(q, true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubTopic) return;
    // For new questions, a unit must be selected
    if (!editingId && !formUnitId) {
      showToast('Please select a Unit for the question', 'error');
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await fetchApi(`/questions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ ...questionForm, unitId: formUnitId || undefined }),
        });
        showToast('Question updated successfully');
      } else {
        await fetchApi(`/units/${formUnitId}/questions`, {
          method: 'POST',
          body: JSON.stringify(questionForm),
        });
        showToast('Question saved successfully');
      }
      setShowAddForm(false);
      setEditingId(null);
      setQuestionForm(EMPTY_FORM);
      setFormUnitId('');
      setFormUnits([]);
      // Refresh questions for this subtopic
      const data = await fetchApi(`/subtopics/${activeSubTopic.id}/questions`);
      const sub = activeSubTopic;
      const currentUnits = allUnits;
      setQuestions((prev) => [
        ...prev.filter((q) => q._subTopicId !== sub.id),
        ...(data as any[]).map((q: any) => {
          const unit = currentUnits.find((u: any) => u.id === q.unitId);
          return {
            ...q,
            _subTopicTitle: sub.title,
            _subTopicId: sub.id,
            _topicTitle: sub._topicTitle,
            _certTitle: sub._certTitle,
            _unitTitle: unit?.title,
          };
        }),
      ]);
    } catch (e) {
      console.error(e);
      showToast('Failed to save question', 'error');
    }
    setLoading(false);
  };

  const deleteQuestion = async (id: string) => {
    setLoading(true);
    try {
      await fetchApi(`/questions/${id}`, { method: 'DELETE' });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      showToast('Question deleted');
    } catch (e: any) {
      showToast(e?.message ?? 'Failed to delete question', 'error');
    }
    setLoading(false);
    setPendingDeleteId(null);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return questions.filter((qu) => {
      const matchSearch =
        !q ||
        qu.questionText.toLowerCase().includes(q) ||
        (qu.tags ?? []).some((t: string) => t.toLowerCase().includes(q));
      const matchDiff = !filterDifficulty || qu.difficulty === filterDifficulty;
      const matchType = !filterQuestionType || qu.questionType === filterQuestionType;
      const matchSub = !activeSubTopicId || qu._subTopicId === activeSubTopicId;
      const matchUnit = !activeUnitId || qu.unitId === activeUnitId;
      const matchTopic =
        !activeTopicId ||
        qu._topicTitle === (allTopics.find((t) => t.id === activeTopicId)?.title ?? '');
      const matchCert =
        !activeCertId ||
        qu._certTitle === (allCerts.find((c) => c.id === activeCertId)?.title ?? '');
      return (
        matchSearch && matchDiff && matchType && matchSub && matchUnit && matchTopic && matchCert
      );
    });
  }, [
    questions,
    search,
    filterDifficulty,
    filterQuestionType,
    activeSubTopicId,
    activeUnitId,
    activeTopicId,
    activeCertId,
    allTopics,
    allCerts,
  ]);

  const { page, pageSize, setPage, setPageSize } = usePagination();
  const paginated = paginate(filtered as any[], page, pageSize);

  return (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white max-w-md text-center ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {pendingDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setPendingDeleteId(null)}
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
                  onClick={() => setPendingDeleteId(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteQuestion(pendingDeleteId)}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Questions Management</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {activeCert && (
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 hover:bg-indigo-100 transition-colors"
              >
                {activeCert.title} <X className="w-3 h-3" />
              </button>
            )}
            {activeTopic && (
              <button
                onClick={() => setActiveTopic(null)}
                className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 hover:bg-amber-100 transition-colors"
              >
                {activeTopic.title} <X className="w-3 h-3" />
              </button>
            )}
            {activeSubTopic && (
              <button
                onClick={() => setActiveSubTopic(null)}
                className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 hover:bg-rose-100 transition-colors"
              >
                {activeSubTopic.title} <X className="w-3 h-3" />
              </button>
            )}
            {activeUnit && (
              <button
                onClick={() => setActiveUnit(null)}
                className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 hover:bg-violet-100 transition-colors"
              >
                {activeUnit.title} <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {!showAddForm && (
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Plus className="w-5 h-5" /> Add Question
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showAddForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                {editingId ? 'Edit Question' : 'New Question'}
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Certification
                  </label>
                  <select
                    value={activeCert?.id ?? ''}
                    onChange={(e) => {
                      setActiveCert(allCerts.find((c) => c.id === e.target.value) ?? null);
                    }}
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
                    value={activeTopic?.id ?? ''}
                    onChange={(e) => {
                      setActiveTopic(filteredTopics.find((t) => t.id === e.target.value) ?? null);
                    }}
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
                    value={activeSubTopic?.id ?? ''}
                    onChange={(e) => {
                      const sub = filteredSubTopics.find((s) => s.id === e.target.value) ?? null;
                      setActiveSubTopic(sub);
                      if (sub) loadFormUnits(sub.id);
                      else {
                        setFormUnits([]);
                        setFormUnitId('');
                      }
                    }}
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
                    value={formUnitId}
                    onChange={(e) => setFormUnitId(e.target.value)}
                    disabled={formUnits.length === 0}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    required={!editingId}
                  >
                    <option value="">
                      {activeSubTopic ? 'Select unit...' : 'Select sub topic first'}
                    </option>
                    {formUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Question Text
                </label>
                <textarea
                  value={questionForm.questionText}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, questionText: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 h-24"
                  placeholder="Enter the question (min 10 chars)..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                    Question Type
                  </label>
                  <select
                    value={questionForm.questionType}
                    onChange={(e) => {
                      const type = e.target.value as 'single' | 'multiple';
                      setQuestionForm({
                        ...questionForm,
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
                    value={questionForm.difficulty}
                    onChange={(e) =>
                      setQuestionForm({ ...questionForm, difficulty: e.target.value as any })
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* Answer options with inline radio/checkbox for correct answer */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Answer Options
                    <span className="ml-2 normal-case font-normal text-slate-400">
                      (
                      {questionForm.questionType === 'single'
                        ? 'select correct with radio'
                        : 'check all correct'}
                      )
                    </span>
                  </label>
                </div>
                <div className="space-y-2">
                  {questionForm.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isSingle = questionForm.questionType === 'single';
                    const isChecked = isSingle
                      ? questionForm.correctAnswers === opt && opt !== ''
                      : (questionForm.correctAnswers as string[]).includes(opt);

                    return (
                      <div key={i} className="flex items-center gap-3">
                        {/* Radio / Checkbox for correct answer */}
                        <input
                          type={isSingle ? 'radio' : 'checkbox'}
                          name="correctAnswer"
                          checked={isChecked}
                          onChange={() => {
                            if (isSingle) {
                              setQuestionForm({ ...questionForm, correctAnswers: opt });
                            } else {
                              const current = [...(questionForm.correctAnswers as string[])];
                              if (current.includes(opt)) {
                                setQuestionForm({
                                  ...questionForm,
                                  correctAnswers: current.filter((c) => c !== opt),
                                });
                              } else {
                                setQuestionForm({
                                  ...questionForm,
                                  correctAnswers: [...current, opt],
                                });
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
                            const newOpts = [...questionForm.options];
                            const oldVal = newOpts[i];
                            newOpts[i] = e.target.value;
                            // Keep correctAnswers in sync when option text changes
                            if (isSingle && questionForm.correctAnswers === oldVal) {
                              setQuestionForm({
                                ...questionForm,
                                options: newOpts,
                                correctAnswers: e.target.value,
                              });
                            } else if (!isSingle) {
                              const ca = (questionForm.correctAnswers as string[]).map((c) =>
                                c === oldVal ? e.target.value : c,
                              );
                              setQuestionForm({
                                ...questionForm,
                                options: newOpts,
                                correctAnswers: ca,
                              });
                            } else {
                              setQuestionForm({ ...questionForm, options: newOpts });
                            }
                          }}
                          className="flex-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 text-sm"
                          placeholder={`Option ${letter}`}
                          required
                        />
                        {questionForm.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = questionForm.options.filter((_, idx) => idx !== i);
                              const removed = questionForm.options[i];
                              let newCA = questionForm.correctAnswers;
                              if (isSingle && newCA === removed) newCA = '';
                              else if (!isSingle)
                                newCA = (newCA as string[]).filter((c) => c !== removed);
                              setQuestionForm({
                                ...questionForm,
                                options: newOpts,
                                correctAnswers: newCA,
                              });
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
                {questionForm.options.length < 5 && (
                  <button
                    type="button"
                    onClick={() =>
                      setQuestionForm({ ...questionForm, options: [...questionForm.options, ''] })
                    }
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
                  >
                    <Plus className="w-4 h-4" /> Add Option
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={questionForm.tags.join(', ')}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
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

              {/* Rich-text explanation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Explanation
                </label>
                <RichTextToolbar targetRef={explanationRef} />
                <textarea
                  ref={explanationRef}
                  value={questionForm.explanation}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, explanation: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 h-28 font-mono text-sm"
                  placeholder="Explain why the answer is correct..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {editingId ? 'Update Question' : 'Save Question'}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Search + filter bar */}
            <div className="flex flex-col gap-3">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm text-slate-900 bg-white"
                  placeholder="Search questions or tags..."
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={activeCert?.id ?? ''}
                  onChange={(e) => {
                    setActiveCert(allCerts.find((c) => c.id === e.target.value) ?? null);
                  }}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold"
                >
                  <option value="">All Certifications</option>
                  {allCerts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <select
                  value={activeTopic?.id ?? ''}
                  onChange={(e) => {
                    setActiveTopic(filteredTopics.find((t) => t.id === e.target.value) ?? null);
                  }}
                  disabled={!activeCertId}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {activeCertId ? 'All Topics' : 'Select Certification first'}
                  </option>
                  {filteredTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={activeSubTopic?.id ?? ''}
                  onChange={(e) =>
                    setActiveSubTopic(
                      filteredSubTopics.find((s) => s.id === e.target.value) ?? null,
                    )
                  }
                  disabled={!activeTopicId}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {activeTopicId ? 'All Sub Topics' : 'Select Topic first'}
                  </option>
                  {filteredSubTopics.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <select
                  value={filterDifficulty}
                  onChange={(e) => setFilterDifficulty(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold"
                >
                  <option value="">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                <select
                  value={filterQuestionType}
                  onChange={(e) => setFilterQuestionType(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold"
                >
                  <option value="">All Question Types</option>
                  <option value="single">Single Answer</option>
                  <option value="multiple">Multiple Answer</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={activeUnit?.id ?? ''}
                  onChange={(e) =>
                    setActiveUnit(filteredUnits.find((u) => u.id === e.target.value) ?? null)
                  }
                  disabled={!activeSubTopicId || filteredUnits.length === 0}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm bg-white text-slate-600 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {activeSubTopicId ? 'All Units' : 'Select Sub Topic first'}
                  </option>
                  {filteredUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Showing{' '}
              <span className="font-bold text-slate-700">
                {Math.min((page - 1) * pageSize + 1, filtered.length)}–
                {Math.min(page * pageSize, filtered.length)}
              </span>{' '}
              of <span className="font-bold text-slate-700">{filtered.length}</span> questions
              {filtered.length < questions.length && (
                <span className="text-slate-400"> (filtered from {questions.length})</span>
              )}
            </p>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-400 font-bold animate-pulse">Loading data...</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-slate-400 font-bold">No questions found.</p>
            ) : (
              paginated.map((q) => (
                <div
                  key={q.id}
                  onClick={() => buildNavigationContextAndNavigate(q, false)}
                  className="p-6 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-sm transition-all space-y-4 cursor-pointer"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 leading-tight">{q.questionText}</h3>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                          q.difficulty === 'Easy'
                            ? 'bg-emerald-100 text-emerald-700'
                            : q.difficulty === 'Medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(q);
                        }}
                        className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(q.id);
                        }}
                        className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {q.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {q.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt: string, i: number) => {
                      const isCorrect = Array.isArray(q.correctAnswers)
                        ? q.correctAnswers.includes(opt)
                        : q.correctAnswers === opt;
                      return (
                        <div
                          key={i}
                          className={`text-sm p-3 rounded-xl border flex items-center gap-2 ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                              : 'bg-slate-50 border-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="font-bold shrink-0">{String.fromCharCode(65 + i)}.</span>
                          {opt}
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Explanation
                    </p>
                    <ExplanationDisplay text={q.explanation ?? ''} options={q.options} />
                  </div>
                </div>
              ))
            )}
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
