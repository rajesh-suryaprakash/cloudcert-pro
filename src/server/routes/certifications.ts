import express from 'express';
import certsRouter from './certifications/certs';
import examsRouter from './certifications/exams';
import questionsRouter, {
  VALID_DIFFICULTIES as QuestionsValidDifficulties,
  isValidDifficulty as QuestionsIsValidDifficulty,
} from './certifications/questions';
import historyRouter from './certifications/history';

const router = express.Router();

// Mount decomposed sub-routers
router.use(certsRouter);
router.use(examsRouter);
router.use(questionsRouter);
router.use(historyRouter);

export const VALID_DIFFICULTIES = QuestionsValidDifficulties;
export const isValidDifficulty = QuestionsIsValidDifficulty;

export default router;
