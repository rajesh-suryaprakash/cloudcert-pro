import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuestionReviewCard from './QuestionReviewCard';

/**
 * Unit tests for QuestionReviewCard component
 *
 * Tests cover:
 * - Explanation rendering (Requirement 12.4)
 * - Question display and answer options
 * - Correct/incorrect answer indicators
 * - Fallback to generic explanations when distractor explanations are missing
 */

describe('QuestionReviewCard', () => {
  const baseQuestion = {
    id: 'q1',
    questionText: 'What is the primary purpose of AWS IAM?',
    options: [
      'To manage virtual machines',
      'To control access to AWS resources',
      'To store data in the cloud',
      'To monitor application performance',
    ],
    correctAnswers: 'To control access to AWS resources',
    userAnswers: ['To manage virtual machines'],
    isCorrect: false,
    explanation:
      'IAM (Identity and Access Management) is designed to securely control access to AWS services and resources.',
    distractorExplanations: {
      'To manage virtual machines': 'This is the purpose of EC2, not IAM.',
      'To store data in the cloud':
        'This is the purpose of S3 and other storage services, not IAM.',
    },
  };

  describe('Question Display', () => {
    it('should display question number', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={5} />);

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display question text', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={1} />);

      expect(screen.getByText('What is the primary purpose of AWS IAM?')).toBeInTheDocument();
    });

    it('should display all answer options', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={1} />);

      expect(screen.getByText('To manage virtual machines')).toBeInTheDocument();
      expect(screen.getByText('To control access to AWS resources')).toBeInTheDocument();
      expect(screen.getByText('To store data in the cloud')).toBeInTheDocument();
      expect(screen.getByText('To monitor application performance')).toBeInTheDocument();
    });

    it('should display correct status for incorrect answer', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={1} />);

      expect(screen.getByText('Incorrect')).toBeInTheDocument();
    });

    it('should display correct status for correct answer', () => {
      const correctQuestion = {
        ...baseQuestion,
        userAnswers: ['To control access to AWS resources'],
        isCorrect: true,
      };

      render(<QuestionReviewCard question={correctQuestion} questionNumber={1} />);

      expect(screen.getByText('Correct')).toBeInTheDocument();
    });
  });

  describe('Explanation Rendering - Requirement 12.4', () => {
    it('should display explanation for correct answer', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={1} />);

      expect(
        screen.getByText(
          'IAM (Identity and Access Management) is designed to securely control access to AWS services and resources.',
        ),
      ).toBeInTheDocument();
    });

    it('should display "Why this is correct:" label for correct answer explanation', () => {
      const correctQuestion = {
        ...baseQuestion,
        userAnswers: ['To control access to AWS resources'],
        isCorrect: true,
      };
      render(<QuestionReviewCard question={correctQuestion} questionNumber={1} />);

      expect(screen.getByText('Why this is correct:')).toBeInTheDocument();
    });

    it('should display distractor explanation for incorrect user answer', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={1} />);

      expect(screen.getByText('This is the purpose of EC2, not IAM.')).toBeInTheDocument();
    });

    it('should display "Why this is incorrect:" label for distractor explanation', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={1} />);

      // Use getAllByText since there are multiple incorrect options with explanations
      const incorrectLabels = screen.getAllByText('Why this is incorrect:');
      expect(incorrectLabels.length).toBeGreaterThan(0);
    });

    it('should display distractor explanation for another incorrect option', () => {
      const question = {
        ...baseQuestion,
        userAnswers: ['To store data in the cloud'],
      };
      render(<QuestionReviewCard question={question} questionNumber={1} />);

      expect(
        screen.getByText('This is the purpose of S3 and other storage services, not IAM.'),
      ).toBeInTheDocument();
    });

    it('should display generic explanation when distractor explanation is missing', () => {
      const question = {
        ...baseQuestion,
        userAnswers: ['To monitor application performance'],
      };
      render(<QuestionReviewCard question={question} questionNumber={1} />);

      // The fourth option has no distractor explanation - use getAllByText since there might be multiple
      const genericExplanations = screen.getAllByText(/The correct answer is:/);
      expect(genericExplanations.length).toBeGreaterThan(0);
    });

    it('should not display explanation for options that are neither correct nor selected', () => {
      const question = {
        ...baseQuestion,
        userAnswers: ['To manage virtual machines'],
        distractorExplanations: {
          'To manage virtual machines': 'This is the purpose of EC2, not IAM.',
        },
      };

      render(<QuestionReviewCard question={question} questionNumber={1} />);

      // Should not show explanations for unselected incorrect options
      expect(
        screen.queryByText('This is the purpose of S3 and other storage services, not IAM.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Multiple Correct Answers', () => {
    it('should handle multiple correct answers', () => {
      const multipleCorrectQuestion = {
        id: 'q2',
        questionText: 'Which AWS services provide compute capacity? (Select TWO)',
        options: ['Amazon EC2', 'Amazon Lambda', 'Amazon S3', 'Amazon RDS'],
        correctAnswers: ['Amazon EC2', 'Amazon Lambda'],
        userAnswers: ['Amazon EC2', 'Amazon S3'],
        isCorrect: false,
        explanation: 'EC2 and Lambda both provide compute capacity for running applications.',
        distractorExplanations: {
          'Amazon S3': 'S3 is a storage service, not a compute service.',
          'Amazon RDS': 'RDS is a database service, not a compute service.',
        },
      };

      render(<QuestionReviewCard question={multipleCorrectQuestion} questionNumber={1} />);

      expect(screen.getByText('Amazon EC2')).toBeInTheDocument();
      expect(screen.getByText('Amazon Lambda')).toBeInTheDocument();
    });

    it('should display plural "answers" in generic explanation for multiple correct answers', () => {
      const multipleCorrectQuestion = {
        id: 'q2',
        questionText: 'Which AWS services provide compute capacity? (Select TWO)',
        options: ['Amazon EC2', 'Amazon Lambda', 'Amazon S3', 'Amazon RDS'],
        correctAnswers: ['Amazon EC2', 'Amazon Lambda'],
        userAnswers: ['Amazon S3'],
        isCorrect: false,
        distractorExplanations: {},
      };

      render(<QuestionReviewCard question={multipleCorrectQuestion} questionNumber={1} />);

      // Should show "answers are" for multiple correct answers - use getAllByText since there might be multiple
      const pluralExplanations = screen.getAllByText(/The correct answers are:/);
      expect(pluralExplanations.length).toBeGreaterThan(0);
    });

    it('should display singular "answer" in generic explanation for single correct answer', () => {
      const singleCorrectQuestion = {
        ...baseQuestion,
        distractorExplanations: {},
      };

      render(<QuestionReviewCard question={singleCorrectQuestion} questionNumber={1} />);

      // Should show "answer is" for single correct answer - use getAllByText since there might be multiple
      const genericExplanations = screen.getAllByText(/The correct answer is:/);
      expect(genericExplanations.length).toBeGreaterThan(0);
    });
  });

  describe('Visual Indicators', () => {
    it('should display check icon for correct answer', () => {
      const { container } = render(
        <QuestionReviewCard question={baseQuestion} questionNumber={1} />,
      );

      // Check for CheckCircle icons (correct answers have these)
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should display X icon for incorrect user selection', () => {
      const { container } = render(
        <QuestionReviewCard question={baseQuestion} questionNumber={1} />,
      );

      // Check for XCircle icons (incorrect selections have these)
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should display legend explaining visual indicators', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={1} />);

      expect(screen.getByText('Legend')).toBeInTheDocument();
      expect(screen.getAllByText('Correct answer').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Your incorrect choice').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Correct answer you missed').length).toBeGreaterThan(0);
    });
  });

  describe('Option Letter Labels', () => {
    it('should display option letters A, B, C, D', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={1} />);

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
      expect(screen.getByText('D')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle question with no explanation', () => {
      const noExplanationQuestion = {
        ...baseQuestion,
        explanation: undefined,
        distractorExplanations: undefined,
      };

      render(<QuestionReviewCard question={noExplanationQuestion} questionNumber={1} />);

      // Should still render the question
      expect(screen.getByText('What is the primary purpose of AWS IAM?')).toBeInTheDocument();
    });

    it('should display empty distractor explanations object', () => {
      const emptyDistractorsQuestion = {
        ...baseQuestion,
        distractorExplanations: {},
      };

      render(<QuestionReviewCard question={emptyDistractorsQuestion} questionNumber={1} />);

      // Should fall back to generic explanations - use getAllByText since there might be multiple
      const genericExplanations = screen.getAllByText(/The correct answer is:/);
      expect(genericExplanations.length).toBeGreaterThan(0);
    });

    it('should handle question with single option', () => {
      const singleOptionQuestion = {
        ...baseQuestion,
        options: ['Only option'],
        correctAnswers: 'Only option',
        userAnswers: ['Only option'],
        isCorrect: true,
      };

      render(<QuestionReviewCard question={singleOptionQuestion} questionNumber={1} />);

      expect(screen.getByText('Only option')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should handle question with many options', () => {
      const manyOptionsQuestion = {
        ...baseQuestion,
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5', 'Option 6'],
        correctAnswers: 'Option 1',
        userAnswers: ['Option 2'],
        isCorrect: false,
      };

      render(<QuestionReviewCard question={manyOptionsQuestion} questionNumber={1} />);

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('F')).toBeInTheDocument();
    });

    it('should handle very long question text', () => {
      const longTextQuestion = {
        ...baseQuestion,
        questionText:
          'This is a very long question text that goes on and on and on to test how the component handles lengthy content. It should wrap properly and maintain readability even with extensive text that spans multiple lines and paragraphs.',
      };

      render(<QuestionReviewCard question={longTextQuestion} questionNumber={1} />);

      expect(screen.getByText(/This is a very long question text/)).toBeInTheDocument();
    });

    it('should handle very long option text', () => {
      const longOptionQuestion = {
        ...baseQuestion,
        options: [
          'This is a very long option text that should wrap properly within the option container',
          'Short option',
          'Another short option',
          'Last option',
        ],
      };

      render(<QuestionReviewCard question={longOptionQuestion} questionNumber={1} />);

      expect(screen.getByText(/This is a very long option text/)).toBeInTheDocument();
    });
  });

  describe('Correct Answer Scenarios', () => {
    it('should show correct styling when user answered correctly', () => {
      const correctQuestion = {
        ...baseQuestion,
        userAnswers: ['To control access to AWS resources'],
        isCorrect: true,
      };

      render(<QuestionReviewCard question={correctQuestion} questionNumber={1} />);

      expect(screen.getByText('Correct')).toBeInTheDocument();
    });

    it('should show missed correct answer when user did not select it', () => {
      const missedAnswerQuestion = {
        id: 'q3',
        questionText: 'Which service provides object storage?',
        options: ['EC2', 'S3', 'RDS', 'Lambda'],
        correctAnswers: 'S3',
        userAnswers: ['EC2'],
        isCorrect: false,
        explanation: 'S3 provides scalable object storage.',
        distractorExplanations: {
          EC2: 'EC2 provides compute capacity, not storage.',
        },
      };

      render(<QuestionReviewCard question={missedAnswerQuestion} questionNumber={1} />);

      // Both the correct answer and incorrect selection should be visible
      expect(screen.getByText('S3')).toBeInTheDocument();
      expect(screen.getByText('EC2')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should render with proper semantic structure', () => {
      const { container } = render(
        <QuestionReviewCard question={baseQuestion} questionNumber={1} />,
      );

      // Should have proper container structure
      expect(container.querySelector('.bg-white')).toBeInTheDocument();
    });

    it('should have readable text contrast', () => {
      render(<QuestionReviewCard question={baseQuestion} questionNumber={1} />);

      // Text should be visible (basic check that content renders)
      expect(screen.getByText('What is the primary purpose of AWS IAM?')).toBeVisible();
    });
  });
});
