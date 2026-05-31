import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './connection';
import { nowMs, nowIso } from '../utils/time';
import { logger } from '../logger';

export const seedAdmin = () => {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables are required');
  }

  const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    const now = nowMs();
    db.prepare(
      'INSERT INTO users (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(crypto.randomUUID(), adminEmail, hashedPassword, 'Admin User', 'admin', now, now);
    logger.warn(`Admin user seeded with email: ${adminEmail}`);
  }
};

export const seedLearner = () => {
  const learnerEmail = process.env.SEED_LEARNER_EMAIL;
  const learnerPassword = process.env.SEED_LEARNER_PASSWORD;

  if (!learnerEmail || !learnerPassword) {
    throw new Error(
      'SEED_LEARNER_EMAIL and SEED_LEARNER_PASSWORD environment variables are required',
    );
  }

  const existingLearner = db.prepare('SELECT * FROM users WHERE email = ?').get(learnerEmail);
  if (!existingLearner) {
    const hashedPassword = bcrypt.hashSync(learnerPassword, 10);
    const now = nowMs();
    db.prepare(
      'INSERT INTO users (id, email, password, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(crypto.randomUUID(), learnerEmail, hashedPassword, 'Test Learner', 'user', now, now);
    logger.warn(`Learner user seeded with email: ${learnerEmail}`);
  }
};

export const seedAchievements = () => {
  const achievements = [
    {
      key: 'exam_first',
      title: 'First Exam',
      description: 'Complete your first exam session',
      category: 'exam',
      tier: 'bronze',
      iconName: 'FileText',
      xpReward: 50,
      requiredValue: 1,
    },
    {
      key: 'exam_perfect',
      title: 'Perfect Score',
      description: 'Get 100% on any exam',
      category: 'exam',
      tier: 'gold',
      iconName: 'CheckCircle',
      xpReward: 500,
      requiredValue: 1,
    },
    {
      key: 'exam_time_master',
      title: 'Time Master',
      description: 'Complete an exam with more than 50% time remaining',
      category: 'exam',
      tier: 'silver',
      iconName: 'Clock',
      xpReward: 200,
      requiredValue: 1,
    },
    {
      key: 'exam_perseverance',
      title: 'Perseverance',
      description: 'Complete 5 exams in a single day',
      category: 'exam',
      tier: 'silver',
      iconName: 'Zap',
      xpReward: 250,
      requiredValue: 5,
    },
    {
      key: 'exam_veteran',
      title: 'Exam Veteran',
      description: 'Complete 10 total exams',
      category: 'exam',
      tier: 'silver',
      iconName: 'Award',
      xpReward: 200,
      requiredValue: 10,
    },
    {
      key: 'exam_legend',
      title: 'Exam Legend',
      description: 'Complete 50 total exams',
      category: 'exam',
      tier: 'platinum',
      iconName: 'Trophy',
      xpReward: 1000,
      requiredValue: 50,
    },
    {
      key: 'study_daily',
      title: 'Daily Learner',
      description: 'Answer at least 10 questions in a day',
      category: 'study',
      tier: 'bronze',
      iconName: 'Book',
      xpReward: 50,
      requiredValue: 10,
    },
    {
      key: 'study_weekly',
      title: 'Weekly Warrior',
      description: 'Answer questions on 7 consecutive days',
      category: 'study',
      tier: 'silver',
      iconName: 'Calendar',
      xpReward: 250,
      requiredValue: 7,
    },
    {
      key: 'study_streak',
      title: 'Study Streak',
      description: 'Maintain a 5-day study streak',
      category: 'study',
      tier: 'bronze',
      iconName: 'Flame',
      xpReward: 100,
      requiredValue: 5,
    },
    {
      key: 'study_dedicated',
      title: 'Dedicated Scholar',
      description: 'Spend 10 total hours studying',
      category: 'study',
      tier: 'gold',
      iconName: 'GraduationCap',
      xpReward: 400,
      requiredValue: 10,
    },
    {
      key: 'study_seeker',
      title: 'Knowledge Seeker',
      description: 'Answer 100 total questions',
      category: 'study',
      tier: 'silver',
      iconName: 'Search',
      xpReward: 200,
      requiredValue: 100,
    },
    {
      key: 'study_master',
      title: 'Knowledge Master',
      description: 'Answer 500 total questions',
      category: 'study',
      tier: 'gold',
      iconName: 'Star',
      xpReward: 500,
      requiredValue: 500,
    },
    {
      key: 'study_early',
      title: 'Early Bird',
      description: 'Complete a study session before 8 AM',
      category: 'study',
      tier: 'bronze',
      iconName: 'Sun',
      xpReward: 50,
      requiredValue: 1,
    },
    {
      key: 'streak_7',
      title: '7-Day Streak',
      description: 'Maintain a 7-day activity streak',
      category: 'streak',
      tier: 'silver',
      iconName: 'Calendar',
      xpReward: 200,
      requiredValue: 7,
    },
    {
      key: 'streak_30',
      title: '30-Day Streak',
      description: 'Maintain a 30-day activity streak',
      category: 'streak',
      tier: 'gold',
      iconName: 'Target',
      xpReward: 500,
      requiredValue: 30,
    },
    {
      key: 'streak_100',
      title: '100-Day Streak',
      description: 'Maintain a 100-day activity streak',
      category: 'streak',
      tier: 'platinum',
      iconName: 'Shield',
      xpReward: 1000,
      requiredValue: 100,
    },
    {
      key: 'score_90',
      title: '90% Club',
      description: 'Achieve a score of 90% or higher on an exam',
      category: 'score',
      tier: 'silver',
      iconName: 'TrendingUp',
      xpReward: 150,
      requiredValue: 90,
    },
    {
      key: 'score_95',
      title: '95% Elite',
      description: 'Achieve a score of 95% or higher on an exam',
      category: 'score',
      tier: 'gold',
      iconName: 'Crown',
      xpReward: 300,
      requiredValue: 95,
    },
    {
      key: 'score_100',
      title: '100% Perfect',
      description: 'Achieve a perfect score on a full-length exam',
      category: 'score',
      tier: 'platinum',
      iconName: 'Star',
      xpReward: 600,
      requiredValue: 100,
    },
    {
      key: 'social_first_comment',
      title: 'First Comment',
      description: 'Post your first discussion comment',
      category: 'social',
      tier: 'bronze',
      iconName: 'MessageCircle',
      xpReward: 50,
      requiredValue: 1,
    },
    {
      key: 'social_helpful',
      title: 'Helpful Contributor',
      description: 'Receive 10 upvotes on your comments',
      category: 'social',
      tier: 'silver',
      iconName: 'ThumbsUp',
      xpReward: 200,
      requiredValue: 10,
    },
    {
      key: 'social_leader',
      title: 'Discussion Leader',
      description: 'Start 5 different discussion threads',
      category: 'social',
      tier: 'gold',
      iconName: 'Users',
      xpReward: 400,
      requiredValue: 5,
    },
    {
      key: 'speed_demon',
      title: 'Speed Demon',
      description: 'Complete an exam in less than 50% of the allotted time',
      category: 'speed',
      tier: 'silver',
      iconName: 'FastForward',
      xpReward: 250,
      requiredValue: 50,
    },
    {
      key: 'speed_lightning',
      title: 'Lightning Fast',
      description: 'Answer a question correctly in under 5 seconds',
      category: 'speed',
      tier: 'bronze',
      iconName: 'Zap',
      xpReward: 50,
      requiredValue: 5,
    },
    {
      key: 'mastery_topic',
      title: 'Topic Master',
      description: 'Complete all questions in a specific topic',
      category: 'mastery',
      tier: 'gold',
      iconName: 'Check',
      xpReward: 500,
      requiredValue: 1,
    },
    {
      key: 'mastery_cert',
      title: 'Certification Ready',
      description: 'Pass 3 consecutive practice exams',
      category: 'mastery',
      tier: 'platinum',
      iconName: 'ShieldCheck',
      xpReward: 800,
      requiredValue: 3,
    },
    {
      key: 'mastery_expert',
      title: 'Subject Expert',
      description: 'Reach level 10 in any certification',
      category: 'mastery',
      tier: 'diamond',
      iconName: 'Gem',
      xpReward: 2000,
      requiredValue: 10,
    },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO achievements (key, title, description, category, tier, iconName, xpReward, requiredValue, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = nowIso();
  achievements.forEach((a) => {
    insert.run(
      a.key,
      a.title,
      a.description,
      a.category,
      a.tier,
      a.iconName,
      a.xpReward,
      a.requiredValue,
      now,
    );
  });
};
