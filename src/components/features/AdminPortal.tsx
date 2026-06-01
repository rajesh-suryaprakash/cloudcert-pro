/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { encodeNavigationContext } from '../../utils/navigationUtils';
import {
  Database,
  Settings,
  FileText,
  BrainCircuit,
  Loader2,
  ShieldCheck,
  Layers,
  BookOpen,
} from 'lucide-react';
import CertificationsPanel from './admin/CertificationsPanel';
import CertificationDetailPanel from './admin/CertificationDetailPanel';
import ExamsPanel from './admin/ExamsPanel';
import ExamDetailPanel from './admin/ExamDetailPanel';
import TopicsPanel from './admin/TopicsPanel';
import TopicDetailPanel from './admin/TopicDetailPanel';
import SubTopicsPanel from './admin/SubTopicsPanel';
import SubTopicDetailPanel from './admin/SubTopicDetailPanel';
import UnitsPanel from './admin/UnitsPanel';
import UnitDetailPanel from './admin/UnitDetailPanel';
import QuestionsPanel from './admin/QuestionsPanel';
import QuestionDetailPanel from './admin/QuestionDetailPanel';
import DomainWeightsPanel from './admin/DomainWeightsPanel';

type View =
  | 'certs'
  | 'cert-detail'
  | 'exams'
  | 'exam-detail'
  | 'topics'
  | 'topic-detail'
  | 'subtopics'
  | 'subtopic-detail'
  | 'units'
  | 'unit-detail'
  | 'questions'
  | 'question-detail'
  | 'domain-weights';

export default function AdminPortal() {
  const { section, certId, topicId } = useParams<{
    section?: string;
    certId?: string;
    topicId?: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Preserve list-view filter params when navigating to a detail view
  const savedListParams = useRef<string>('');
  // Ordered ID list from the list panel (reflects current filters/sort)
  const savedIdList = useRef<string[]>([]);

  // Determine current view from URL
  // If section is 'cert' and certId exists, show cert-detail view
  // If section is 'exam' and certId exists (used as examId), show exam-detail view
  // If section is 'domain-weights' and certId exists, show domain-weights view
  let view: View = 'certs';
  if (section === 'cert' && certId) {
    view = 'cert-detail';
  } else if (section === 'exam' && certId) {
    view = 'exam-detail';
  } else if (section === 'topic' && certId) {
    view = 'topic-detail';
  } else if (section === 'subtopic' && certId) {
    view = 'subtopic-detail';
  } else if (section === 'unit' && certId) {
    view = 'unit-detail';
  } else if (section === 'question' && certId) {
    view = 'question-detail';
  } else if (section === 'domain-weights' && certId) {
    view = 'domain-weights';
  } else if (section) {
    view = section as View;
  }

  const [selectedCert, setSelectedCert] = useState<any>(null);
  const [_selectedExam, setSelectedExam] = useState<any>(null);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [_selectedSubTopic, setSelectedSubTopic] = useState<any>(null);
  const [_selectedUnit, setSelectedUnit] = useState<any>(null);
  const [_selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [_showEditCertForm, setShowEditCertForm] = useState(false);
  const [_showEditExamForm, setShowEditExamForm] = useState(false);
  const [_editingCert, setEditingCert] = useState<any>(null);
  const [_editingExam, setEditingExam] = useState<any>(null);

  // Scale down the root font size for the admin section so all rem-based
  // Tailwind sizes render slightly smaller. Restored on unmount.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.fontSize;
    html.style.fontSize = '14px'; // Tailwind default is 16px; 14px = ~87.5%
    return () => {
      html.style.fontSize = prev;
    };
  }, []);

  // Load selected items based on URL parameters
  useEffect(() => {
    const loadData = async () => {
      // Detail views (cert-detail, exam-detail, topic-detail, subtopic-detail, question-detail) handle their own data fetching
      // Skip loading here to avoid incorrect redirects
      if (
        view === 'cert-detail' ||
        view === 'exam-detail' ||
        view === 'topic-detail' ||
        view === 'subtopic-detail' ||
        view === 'unit-detail' ||
        view === 'question-detail'
      ) {
        return;
      }

      if (!certId) {
        setSelectedCert(null);
        setSelectedTopic(null);
        setSelectedSubTopic(null);
        return;
      }

      setLoading(true);
      try {
        // Load certification
        const certs = await fetchApi('/certifications');
        const cert = certs.find((c: any) => c.id === certId);
        if (cert) {
          setSelectedCert(cert);
        } else {
          navigate('/admin/certs');
          return;
        }

        // Load topic if specified
        if (topicId && cert) {
          const topics = await fetchApi(`/certifications/${certId}/topics`);
          const topic = topics.find((t: any) => t.id === topicId);
          if (topic) {
            setSelectedTopic(topic);
          } else {
            navigate(`/admin/topics/${certId}`);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load admin data:', error);
        navigate('/admin/certs');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [certId, topicId, view, navigate]);

  // Redirect logic for sections that require selections - only redirect if there's a real issue
  useEffect(() => {
    // Only redirect exams if no cert is selected and we're trying to view a specific cert's exams
    if (view === 'exams' && certId && !selectedCert && !loading) {
      navigate('/admin/exams');
    }
    // Only redirect subtopics/questions if we have invalid URL params (cert exists but topic doesn't)
    else if (
      (view === 'subtopics' || view === 'questions') &&
      certId &&
      topicId &&
      selectedCert &&
      !selectedTopic &&
      !loading
    ) {
      navigate(`/admin/${view}/${certId}`);
    }
  }, [view, selectedCert, selectedTopic, certId, topicId, navigate, loading]);

  const handleSelectCert = (cert: any, openEdit = false, ids?: string[]) => {
    setSelectedCert(cert);
    setSelectedExam(null);
    setSelectedTopic(null);
    setSelectedSubTopic(null);

    // Save current list params for back navigation
    savedListParams.current = searchParams.toString();
    if (ids) savedIdList.current = ids;

    // Build navigation context for URL encoding
    const idList = ids ?? savedIdList.current;
    const filters: Record<string, string> = {};

    // Preserve filter state for navigation context
    const search = searchParams.get('search');
    const vendor = searchParams.get('vendor');

    if (search) {
      filters.search = search;
    }
    if (vendor) {
      filters.vendor = vendor;
    }

    // Use encodeNavigationContext utility with sessionStorage fallback
    const context = {
      ids: idList,
      currentId: cert.id,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    const baseUrl = `${window.location.origin}/admin/cert/${cert.id}`;
    const navParams = encodeNavigationContext(context, baseUrl);

    // Add edit flag if needed
    if (openEdit) {
      navParams.set('edit', 'true');
    }

    const queryString = navParams.toString();
    navigate(`/admin/cert/${cert.id}${queryString ? `?${queryString}` : ''}`);
  };

  const handleEditCert = (cert: any) => {
    setEditingCert(cert);
    setShowEditCertForm(true);
    // Stay on the same page, just show the edit form
  };

  const handleDeleteCert = async (certId: string) => {
    await fetchApi(`/certifications/${certId}`, { method: 'DELETE' });
    // Navigate back to certifications list
    navigate('/admin/certs');
  };

  const handleBackToCerts = (vendor?: string) => {
    setSelectedCert(null);
    setEditingCert(null);
    setShowEditCertForm(false);
    const saved = savedListParams.current;
    if (saved) {
      navigate(`/admin/certs?${saved}`);
    } else {
      navigate(vendor ? `/admin/certs?vendor=${encodeURIComponent(vendor)}` : '/admin/certs');
    }
  };

  const handleSelectExam = (exam: any, openEdit = false, ids?: string[]) => {
    setSelectedExam(exam);
    savedListParams.current = searchParams.toString();
    if (ids) savedIdList.current = ids;

    // Build navigation context for URL encoding
    const idList = ids ?? savedIdList.current;
    const filters: Record<string, string> = {};

    // Preserve filter state for navigation context
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const certId = searchParams.get('certId');
    if (search) filters.search = search;
    if (status) filters.status = status;
    if (certId) filters.certId = certId;

    // Use encodeNavigationContext utility with sessionStorage fallback
    const context = {
      ids: idList,
      currentId: exam.id,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    const baseUrl = `${window.location.origin}/admin/exam/${exam.id}`;
    const navParams = encodeNavigationContext(context, baseUrl);

    if (openEdit) navParams.set('edit', 'true');

    const queryString = navParams.toString();
    navigate(`/admin/exam/${exam.id}${queryString ? `?${queryString}` : ''}`);
  };

  const handleEditExam = (exam: any) => {
    setEditingExam(exam);
    setShowEditExamForm(true);
    // Stay on the same page, just show the edit form
  };

  const handleDeleteExam = async (examId: string) => {
    await fetchApi(`/exams/${examId}`, { method: 'DELETE' });
    // Navigate back to exams list
    navigate('/admin/exams');
  };

  const handleBackToExams = (certId?: string) => {
    setSelectedExam(null);
    setEditingExam(null);
    setShowEditExamForm(false);
    // Restore saved params (includes certId, status, search) — fall back to certId-only if nothing saved
    const saved = savedListParams.current;
    if (saved) {
      navigate(`/admin/exams?${saved}`);
    } else {
      navigate(certId ? `/admin/exams?certId=${certId}` : '/admin/exams');
    }
  };

  const handleSelectTopic = (topic: any, openEdit = false, ids?: string[]) => {
    setSelectedTopic(topic);
    setSelectedSubTopic(null);
    savedListParams.current = searchParams.toString();
    if (ids) savedIdList.current = ids;

    // Build navigation context for URL encoding
    const idList = ids ?? savedIdList.current;
    const filters: Record<string, string> = {};

    // Preserve filter state for navigation context
    const search = searchParams.get('search');
    const certId = searchParams.get('certId');
    if (search) filters.search = search;
    if (certId) filters.certId = certId;

    // Use encodeNavigationContext utility with sessionStorage fallback
    const context = {
      ids: idList,
      currentId: topic.id,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    const baseUrl = `${window.location.origin}/admin/topic/${topic.id}`;
    const navParams = encodeNavigationContext(context, baseUrl);

    if (openEdit) navParams.set('edit', 'true');

    const queryString = navParams.toString();
    navigate(`/admin/topic/${topic.id}${queryString ? `?${queryString}` : ''}`);
  };

  const handleDeleteTopic = async (topicId: string) => {
    await fetchApi(`/topics/${topicId}`, { method: 'DELETE' });
    navigate('/admin/topics');
  };

  const handleBackToTopics = (certId?: string) => {
    setSelectedTopic(null);
    const saved = savedListParams.current;
    if (saved) {
      navigate(`/admin/topics?${saved}`);
    } else {
      navigate(certId ? `/admin/topics?certId=${certId}` : '/admin/topics');
    }
  };

  const handleSelectSubTopic = (subtopic: any, openEdit = false, ids?: string[]) => {
    setSelectedSubTopic(subtopic);
    savedListParams.current = searchParams.toString();
    if (ids) savedIdList.current = ids;

    // Build navigation context for URL encoding
    const idList = ids ?? savedIdList.current;
    const filters: Record<string, string> = {};

    // Preserve filter state for navigation context
    const search = searchParams.get('search');
    const certId = searchParams.get('certId');
    const topicId = searchParams.get('topicId');
    if (search) filters.search = search;
    if (certId) filters.certId = certId;
    if (topicId) filters.topicId = topicId;

    // Use encodeNavigationContext utility with sessionStorage fallback
    const context = {
      ids: idList,
      currentId: subtopic.id,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    const baseUrl = `${window.location.origin}/admin/subtopic/${subtopic.id}`;
    const navParams = encodeNavigationContext(context, baseUrl);

    if (openEdit) navParams.set('edit', 'true');

    const queryString = navParams.toString();
    navigate(`/admin/subtopic/${subtopic.id}${queryString ? `?${queryString}` : ''}`);
  };

  const handleDeleteSubTopic = async (subtopicId: string) => {
    await fetchApi(`/subtopics/${subtopicId}`, { method: 'DELETE' });
    navigate('/admin/subtopics');
  };

  const handleBackToSubTopics = (certId?: string, topicId?: string) => {
    setSelectedSubTopic(null);
    const saved = savedListParams.current;
    if (saved) {
      navigate(`/admin/subtopics?${saved}`);
    } else {
      const params = new URLSearchParams();
      if (certId) params.set('certId', certId);
      if (topicId) params.set('topicId', topicId);
      const qs = params.toString();
      navigate(qs ? `/admin/subtopics?${qs}` : '/admin/subtopics');
    }
  };

  const handleSelectUnit = (unit: any, openEdit = false, ids?: string[]) => {
    setSelectedUnit(unit);
    savedListParams.current = searchParams.toString();
    if (ids) savedIdList.current = ids;

    // Build navigation context for URL encoding
    const idList = ids ?? savedIdList.current;
    const filters: Record<string, string> = {};

    // Preserve filter state for navigation context
    const search = searchParams.get('search');
    const filterCertId = searchParams.get('certId');
    const filterTopicId = searchParams.get('topicId');
    const filterSubTopicId = searchParams.get('subTopicId');
    if (search) filters.search = search;
    if (filterCertId) filters.certId = filterCertId;
    if (filterTopicId) filters.topicId = filterTopicId;
    if (filterSubTopicId) filters.subTopicId = filterSubTopicId;

    // Use encodeNavigationContext utility with sessionStorage fallback
    const context = {
      ids: idList,
      currentId: unit.id,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    const baseUrl = `${window.location.origin}/admin/unit/${unit.id}`;
    const navParams = encodeNavigationContext(context, baseUrl);

    if (openEdit) navParams.set('edit', 'true');

    const queryString = navParams.toString();
    navigate(`/admin/unit/${unit.id}${queryString ? `?${queryString}` : ''}`);
  };

  const handleDeleteUnit = async (unitId: string) => {
    await fetchApi(`/units/${unitId}`, { method: 'DELETE' });
    navigate('/admin/units');
  };

  const handleBackToUnits = (certId?: string, topicId?: string, subtopicId?: string) => {
    setSelectedUnit(null);
    const saved = savedListParams.current;
    if (saved) {
      navigate(`/admin/units?${saved}`);
    } else {
      const params = new URLSearchParams();
      if (certId) params.set('certId', certId);
      if (topicId) params.set('topicId', topicId);
      if (subtopicId) params.set('subTopicId', subtopicId);
      const qs = params.toString();
      navigate(qs ? `/admin/units?${qs}` : '/admin/units');
    }
  };

  const handleSelectQuestion = (question: any, openEdit = false, ids?: string[]) => {
    setSelectedQuestion(question);
    savedListParams.current = searchParams.toString();
    if (ids) savedIdList.current = ids;

    // Build navigation context for URL encoding
    const idList = ids ?? savedIdList.current;
    const filters: Record<string, string> = {};

    // Preserve filter state for navigation context
    const search = searchParams.get('search');
    const certId = searchParams.get('certId');
    const topicId = searchParams.get('topicId');
    const subTopicId = searchParams.get('subTopicId');
    const difficulty = searchParams.get('difficulty');
    if (search) filters.search = search;
    if (certId) filters.certId = certId;
    if (topicId) filters.topicId = topicId;
    if (subTopicId) filters.subTopicId = subTopicId;
    if (difficulty) filters.difficulty = difficulty;

    // Use encodeNavigationContext utility with sessionStorage fallback
    const context = {
      ids: idList,
      currentId: question.id,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };

    const baseUrl = `${window.location.origin}/admin/question/${question.id}`;
    const navParams = encodeNavigationContext(context, baseUrl);

    if (openEdit) navParams.set('edit', 'true');

    const queryString = navParams.toString();
    navigate(`/admin/question/${question.id}${queryString ? `?${queryString}` : ''}`);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    await fetchApi(`/questions/${questionId}`, { method: 'DELETE' });
    navigate('/admin/questions');
  };

  const handleBackToQuestions = (certId?: string, topicId?: string, subTopicId?: string) => {
    setSelectedQuestion(null);
    const saved = savedListParams.current;
    if (saved) {
      navigate(`/admin/questions?${saved}`);
    } else {
      const params = new URLSearchParams();
      if (certId) params.set('certId', certId);
      if (topicId) params.set('topicId', topicId);
      if (subTopicId) params.set('subTopicId', subTopicId);
      const qs = params.toString();
      navigate(qs ? `/admin/questions?${qs}` : '/admin/questions');
    }
  };

  const seedInitialData = async () => {
    if (!confirm('This will seed initial certifications. Continue?')) return;
    setIsSeeding(true);
    try {
      const certsToSeed = [
        {
          name: 'AWS Certified Solutions Architect - Associate',
          provider: 'AWS',
          description:
            'Design resilient, high-performing, secure, and cost-optimized architectures.',
        },
        {
          name: 'Google Associate Cloud Engineer',
          provider: 'GCP',
          description: 'Deploy applications, monitor operations, and manage enterprise solutions.',
        },
        {
          name: 'Microsoft Azure Fundamentals (AZ-900)',
          provider: 'Azure',
          description:
            'Foundational knowledge of cloud services and how those services are provided with Azure.',
        },
      ];
      for (const c of certsToSeed) {
        await fetchApi('/certifications', { method: 'POST', body: JSON.stringify(c) });
      }
      alert('Initial data seeded successfully!');
    } catch (e) {
      console.error(e);
    }
    setIsSeeding(false);
  };

  // Map detail views back to their parent section for sidebar highlighting
  const activeSection =
    view === 'cert-detail'
      ? 'certs'
      : view === 'exam-detail'
        ? 'exams'
        : view === 'topic-detail'
          ? 'topics'
          : view === 'subtopic-detail'
            ? 'subtopics'
            : view === 'unit-detail'
              ? 'units'
              : view === 'domain-weights'
                ? 'certs'
                : view;

  const navigateTo = (target: View) => {
    if (target === 'certs') {
      navigate('/admin/certs');
    } else if (target === 'exams') {
      navigate('/admin/exams');
    } else if (target === 'topics') {
      navigate('/admin/topics');
    } else if (target === 'subtopics') {
      navigate('/admin/subtopics');
    } else if (target === 'units') {
      navigate('/admin/units');
    } else if (target === 'questions') {
      navigate('/admin/questions');
    } else if (target === 'domain-weights') {
      navigate('/admin/domain-weights');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-72 bg-white rounded-3xl border border-slate-200 p-6 space-y-2 h-fit">
        <div className="flex items-center gap-2 px-4 mb-6">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          <h2 className="text-lg font-black text-slate-900">Admin Panel</h2>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => navigateTo('certs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeSection === 'certs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Database className="w-5 h-5" /> Certifications
          </button>
          <button
            onClick={() => navigateTo('exams')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeSection === 'exams' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <FileText className="w-5 h-5" /> Exams
          </button>
          <button
            onClick={() => navigateTo('topics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeSection === 'topics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Settings className="w-5 h-5" /> Topics
          </button>
          <button
            onClick={() => navigateTo('subtopics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeSection === 'subtopics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Layers className="w-5 h-5" /> Sub Topics
          </button>
          <button
            onClick={() => navigateTo('units')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeSection === 'units' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <BookOpen className="w-5 h-5" /> Units
          </button>
          <button
            onClick={() => navigateTo('questions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeSection === 'questions' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <BrainCircuit className="w-5 h-5" /> Questions
          </button>
        </nav>

        <div className="pt-6 mt-6 border-t border-slate-100 space-y-2">
          <button
            onClick={seedInitialData}
            disabled={isSeeding}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            {isSeeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Seed Initial Data
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-white rounded-3xl border border-slate-200 p-8 overflow-y-auto min-h-[600px]">
        {view === 'cert-detail' && certId ? (
          <CertificationDetailPanel
            certificationId={certId}
            onEdit={handleEditCert}
            onDelete={handleDeleteCert}
            onBack={handleBackToCerts}
          />
        ) : view === 'exam-detail' && certId ? (
          <ExamDetailPanel
            examId={certId}
            onEdit={handleEditExam}
            onDelete={handleDeleteExam}
            onBack={handleBackToExams}
          />
        ) : view === 'domain-weights' && certId ? (
          <DomainWeightsPanel certificationId={certId} />
        ) : view === 'exams' ? (
          <ExamsPanel onSelectExam={handleSelectExam} />
        ) : view === 'topics' ? (
          <TopicsPanel onSelectTopic={handleSelectTopic} />
        ) : view === 'topic-detail' && certId ? (
          <TopicDetailPanel
            topicId={certId}
            onDelete={handleDeleteTopic}
            onBack={handleBackToTopics}
          />
        ) : view === 'subtopics' ? (
          <SubTopicsPanel onSelectSubTopic={handleSelectSubTopic} />
        ) : view === 'subtopic-detail' && certId ? (
          <SubTopicDetailPanel
            subtopicId={certId}
            onDelete={handleDeleteSubTopic}
            onBack={handleBackToSubTopics}
          />
        ) : view === 'units' ? (
          <UnitsPanel onSelectUnit={handleSelectUnit} />
        ) : view === 'unit-detail' && certId ? (
          <UnitDetailPanel
            unitId={certId}
            onDelete={handleDeleteUnit}
            onBack={handleBackToUnits}
          />
        ) : view === 'questions' ? (
          <QuestionsPanel onSelectQuestion={handleSelectQuestion} />
        ) : view === 'question-detail' && certId ? (
          <QuestionDetailPanel
            questionId={certId}
            onEdit={(question) => handleSelectQuestion(question, true)}
            onDelete={handleDeleteQuestion}
            onBack={handleBackToQuestions}
          />
        ) : (
          <CertificationsPanel onSelectCert={handleSelectCert} />
        )}
      </main>
    </div>
  );
}
