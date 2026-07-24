import { fetchApi } from './client';

export interface FetchExamQuestionsOptions {
  /** Wizard override: number of questions to select (takes priority over exam config's totalQuestions) */
  count?: number;
  /** Wizard override: pre-filter pool to this difficulty before selection */
  difficulty?: string;
}

export const fetchExamQuestions = (examId: string, options?: FetchExamQuestionsOptions) => {
  const params = new URLSearchParams();
  if (options?.count !== undefined) params.set('count', String(options.count));
  if (options?.difficulty && options.difficulty !== 'Mixed')
    params.set('difficulty', options.difficulty);
  const qs = params.toString();
  return fetchApi(`/exams/${examId}/questions${qs ? `?${qs}` : ''}`);
};

export const createExamSession = (data: object) =>
  fetchApi('/exam-sessions', { method: 'POST', body: JSON.stringify(data) });

export const submitExamSession = (sessionId: string) =>
  fetchApi(`/exam-sessions/${sessionId}/submit`, { method: 'POST' });

export const fetchExamSession = (sessionId: string) => fetchApi(`/exam-sessions/${sessionId}`);

/**
 * Pause an in-progress timed exam session.
 * The server records the pause timestamp and sets status to 'paused'.
 */
export const pauseExamSession = (sessionId: string) =>
  fetchApi(`/exam-sessions/${sessionId}/pause`, { method: 'POST' });

/**
 * Resume a paused exam session.
 * The server extends autoSubmitAt by the pause duration and returns:
 *   { ok, status, autoSubmitAt, timeLeftSeconds }
 * so the client can sync its countdown timer.
 */
export const resumeExamSession = (
  sessionId: string,
): Promise<{ ok: boolean; status: string; autoSubmitAt: string; timeLeftSeconds: number }> =>
  fetchApi(`/exam-sessions/${sessionId}/resume`, { method: 'POST' });
