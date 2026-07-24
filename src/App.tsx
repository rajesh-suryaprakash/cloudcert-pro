import { useCallback } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { motion } from 'motion/react';
import { AuthProvider } from './AuthContext';
import { KeyboardShortcutProvider } from './contexts/KeyboardShortcutContext';
import { useAuth } from './hooks/useAuth';
import { useExamSession } from './hooks/useExamSession';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { fetchApi } from './api/client';
import AdminPortal from './components/features/AdminPortal';
import UserDashboard from './components/features/UserDashboard';
import Quiz from './components/features/Quiz';
import AuthForm from './components/features/AuthForm';
import InsightDashboard from './components/features/InsightDashboard';
import AppShell from './components/layouts/AppShell';

/**
 * Derives a human-readable page title from the current pathname.
 * Returns null to fall back to the app name for the root/unknown routes.
 */
function useRouteTitle(): string | null {
  const location = useLocation();
  const { pathname } = location;

  if (pathname.startsWith('/admin')) return 'Admin Portal';
  if (pathname.startsWith('/insights')) return 'Insights';
  if (pathname.startsWith('/quiz')) return 'Practice Exam';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  return null; // root → "CloudCert Pro"
}

function MainApp() {
  const { user, role, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Dynamically update the browser tab title based on the current route
  const routeTitle = useRouteTitle();
  useDocumentTitle(user ? routeTitle : 'Sign In');

  // Role-based route guards — single source of truth for access control
  const isAdmin = role === 'admin';
  const {
    quizQuestions,
    activeExam,
    activeSessionId,
    historicalAttempt,
    startQuiz,
    startTopicQuiz,
    startSubtopicQuiz,
    startCustomQuiz,
    viewHistoricalAttempt,
    reset,
  } = useExamSession();

  // Determine if we're in admin view based on current URL
  const isAdminView = location.pathname.startsWith('/admin');

  // Shared callback for resetting the exam state and returning to the relevant dashboard
  const handleReset = useCallback(async () => {
    reset();

    try {
      if (activeSessionId) {
        const session = (await fetchApi(`/exam-sessions/${activeSessionId}`)) as {
          certificationId?: string;
        } | null;
        if (session && session.certificationId) {
          navigate(`/dashboard/${session.certificationId}`);
          return;
        }
      }

      if (activeExam?.certificationId) {
        navigate(`/dashboard/${activeExam.certificationId}`);
        return;
      }

      navigate('/dashboard');
    } catch (e) {
      console.error('Failed to get certification ID:', e);
      navigate('/dashboard');
    }
  }, [reset, activeSessionId, activeExam, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSuccess={() => {}} />;
  }

  return (
    <AppShell
      user={user}
      role={role}
      isAdminView={isAdminView}
      onToggleAdmin={() => {
        if (isAdminView) {
          // Only non-admin users can switch to dashboard
          if (!isAdmin) navigate('/dashboard');
        } else {
          navigate('/admin/certs');
        }
      }}
      onReset={handleReset}
      onLogout={logout}
    >
      <Routes>
        {/* Root redirect — admins go to admin panel, users go to dashboard */}
        <Route
          path="/"
          element={<Navigate to={isAdmin ? '/admin/certs' : '/dashboard'} replace />}
        />

        <Route path="/admin" element={<Navigate to="/admin/certs" replace />} />

        <Route
          path="/admin/:section"
          element={
            !isAdmin ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <motion.div
                key="admin-section"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full"
              >
                <AdminPortal />
              </motion.div>
            )
          }
        />

        <Route
          path="/admin/:section/:certId"
          element={
            !isAdmin ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <motion.div
                key="admin-cert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full"
              >
                <AdminPortal />
              </motion.div>
            )
          }
        />

        <Route
          path="/admin/:section/:certId/:topicId"
          element={
            !isAdmin ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <motion.div
                key="admin-topic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full"
              >
                <AdminPortal />
              </motion.div>
            )
          }
        />

        <Route
          path="/insights/:certificationId"
          element={
            isAdmin ? (
              <Navigate to="/admin/certs" replace />
            ) : (
              <InsightsRoute
                startTopicQuiz={startTopicQuiz}
                startSubtopicQuiz={startSubtopicQuiz}
                quizQuestions={quizQuestions}
                reset={reset}
              />
            )
          }
        />

        <Route
          path="/insights/:certificationId/topics/:domainId"
          element={
            isAdmin ? (
              <Navigate to="/admin/certs" replace />
            ) : (
              <InsightsRoute
                startTopicQuiz={startTopicQuiz}
                startSubtopicQuiz={startSubtopicQuiz}
                quizQuestions={quizQuestions}
                reset={reset}
              />
            )
          }
        />

        <Route
          path="/insights/:certificationId/topics/:domainId/subtopics/:topicId"
          element={
            isAdmin ? (
              <Navigate to="/admin/certs" replace />
            ) : (
              <InsightsRoute
                startTopicQuiz={startTopicQuiz}
                startSubtopicQuiz={startSubtopicQuiz}
                quizQuestions={quizQuestions}
                reset={reset}
              />
            )
          }
        />

        <Route
          path="/quiz"
          element={
            isAdmin ? (
              <Navigate to="/admin/certs" replace />
            ) : quizQuestions ? (
              <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Quiz
                  questions={quizQuestions}
                  examConfig={activeExam || undefined}
                  sessionId={activeSessionId || undefined}
                  historicalAttempt={historicalAttempt}
                  onFinish={() => {}}
                  onReset={handleReset}
                  onStartTopicQuiz={startTopicQuiz}
                  onViewInsights={(certId: string, certTitle: string, sessionId?: string) => {
                    const params = new URLSearchParams({ certTitle });
                    if (sessionId) params.append('sessionId', sessionId);
                    navigate(`/insights/${certId}?${params.toString()}`);
                  }}
                />
              </motion.div>
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            isAdmin ? (
              <Navigate to="/admin/certs" replace />
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <UserDashboard
                  onStartQuiz={async (...args) => {
                    await startQuiz(...args);
                    navigate('/quiz');
                  }}
                  onStartTopicQuiz={async (...args) => {
                    await startTopicQuiz(...args);
                    navigate('/quiz');
                  }}
                  onViewAttempt={async (...args) => {
                    await viewHistoricalAttempt(...args);
                    navigate('/quiz');
                  }}
                  onStartCustomQuiz={async (...args) => {
                    await startCustomQuiz(...args);
                    navigate('/quiz');
                  }}
                  onViewInsights={(certId: string, certTitle: string, sessionId?: string) => {
                    const params = new URLSearchParams({ certTitle });
                    if (sessionId) params.append('sessionId', sessionId);
                    navigate(`/insights/${certId}?${params.toString()}`);
                  }}
                />
              </motion.div>
            )
          }
        />

        <Route
          path="/dashboard/:certificationId"
          element={
            isAdmin ? (
              <Navigate to="/admin/certs" replace />
            ) : (
              <motion.div
                key="dashboard-cert"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <UserDashboard
                  onStartQuiz={async (...args) => {
                    await startQuiz(...args);
                    navigate('/quiz');
                  }}
                  onStartTopicQuiz={async (...args) => {
                    await startTopicQuiz(...args);
                    navigate('/quiz');
                  }}
                  onViewAttempt={async (...args) => {
                    await viewHistoricalAttempt(...args);
                    navigate('/quiz');
                  }}
                  onStartCustomQuiz={async (...args) => {
                    await startCustomQuiz(...args);
                    navigate('/quiz');
                  }}
                  onViewInsights={(certId: string, certTitle: string, sessionId?: string) => {
                    const params = new URLSearchParams({ certTitle });
                    if (sessionId) params.append('sessionId', sessionId);
                    navigate(`/insights/${certId}?${params.toString()}`);
                  }}
                />
              </motion.div>
            )
          }
        />
      </Routes>
    </AppShell>
  );
}

function InsightsRoute({
  startTopicQuiz,
  startSubtopicQuiz,
  quizQuestions,
  reset,
}: {
  startTopicQuiz: (
    cert: { id: string; title: string },
    topic: { id: string; title: string },
  ) => Promise<void>;
  startSubtopicQuiz: (
    cert: { id: string; title: string },
    topic: { id: string; title: string },
    subtopicIds: string[],
  ) => Promise<void>;
  quizQuestions: unknown;
  reset: () => void;
}) {
  const { certificationId, domainId, topicId } = useParams<{
    certificationId: string;
    domainId?: string;
    topicId?: string;
  }>();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const certificationTitle = searchParams.get('certTitle') || '';
  const sessionId = searchParams.get('sessionId') || undefined;

  if (!certificationId) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <InsightDashboard
        certificationId={certificationId}
        certificationTitle={certificationTitle}
        sessionId={sessionId}
        initialDomainId={domainId}
        initialTopicId={topicId}
        onBack={() => {
          // If we came from a quiz (completed exam), reset to go back to UserDashboard
          if (quizQuestions) {
            reset();
          }
          // Navigate to the certification-specific dashboard view
          navigate(`/dashboard/${certificationId}`);
        }}
        onNavigateToTopics={(domainId: string, domainName: string) => {
          const params = new URLSearchParams({ certTitle: certificationTitle });
          if (sessionId) params.append('sessionId', sessionId);
          params.append('domainName', domainName);
          navigate(`/insights/${certificationId}/topics/${domainId}?${params.toString()}`);
        }}
        onNavigateToSubtopics={(domainId: string, topicId: string, topicName: string) => {
          const params = new URLSearchParams({ certTitle: certificationTitle });
          if (sessionId) params.append('sessionId', sessionId);
          params.append('topicName', topicName);
          navigate(
            `/insights/${certificationId}/topics/${domainId}/subtopics/${topicId}?${params.toString()}`,
          );
        }}
        onNavigateToDashboard={() => {
          const params = new URLSearchParams({ certTitle: certificationTitle });
          if (sessionId) params.append('sessionId', sessionId);
          navigate(`/insights/${certificationId}?${params.toString()}`);
        }}
        onStartTopicQuiz={async (topicId: string, topicName: string) => {
          const cert = { id: certificationId, title: certificationTitle };
          const topic = { id: topicId, title: topicName };
          await startTopicQuiz(cert, topic);
          navigate('/quiz');
        }}
        onStartSubtopicQuiz={async (topicId: string, topicName: string, subtopicIds: string[]) => {
          const cert = { id: certificationId, title: certificationTitle };
          const topic = { id: topicId, title: topicName };
          await startSubtopicQuiz(cert, topic, subtopicIds);
          navigate('/quiz');
        }}
      />
    </motion.div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <KeyboardShortcutProvider>
        <BrowserRouter>
          <MainApp />
        </BrowserRouter>
      </KeyboardShortcutProvider>
    </AuthProvider>
  );
}
