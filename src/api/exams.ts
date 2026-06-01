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
