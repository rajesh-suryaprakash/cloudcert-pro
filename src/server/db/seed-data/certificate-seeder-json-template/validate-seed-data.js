#!/usr/bin/env node
/**
 * Seed Data Validation Script
 *
 * Validates certification seed data against the current schema requirements.
 * Run this before seeding to catch errors early.
 *
 * Usage:
 *   node validate-seed-data.js <path-to-cert-folder>
 *
 * Example:
 *   node validate-seed-data.js ../gcp/gcp-ace
 */

import fs from 'fs';
import path from 'path';

const VALID_STRATEGIES = new Set(['random', 'difficulty_balanced', 'topic_based']);
const VALID_DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);
const VALID_QUESTION_TYPES = new Set(['single', 'multiple']);
const VALID_LEVELS = new Set(['Foundational', 'Associate', 'Professional', 'Expert']);

let errors = [];
let warnings = [];

function error(message) {
  errors.push(`❌ ERROR: ${message}`);
}

function warn(message) {
  warnings.push(`⚠️  WARNING: ${message}`);
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    error(`Failed to parse ${filePath}: ${err.message}`);
    return null;
  }
}

function validateCertification(cert, file) {
  if (!cert) {
    error(`${file} not found or invalid`);
    return false;
  }

  if (!cert.id) error(`${file}: missing 'id' field`);
  if (!cert.title) error(`${file}: missing 'title' field`);
  if (!cert.vendor) error(`${file}: missing 'vendor' field`);
  if (!cert.level) error(`${file}: missing 'level' field`);

  if (cert.level && !VALID_LEVELS.has(cert.level)) {
    error(
      `${file}: invalid level '${cert.level}'. Must be one of: ${Array.from(VALID_LEVELS).join(', ')}`,
    );
  }

  return errors.length === 0;
}

function validateTopics(topics, file, certId) {
  if (!topics || !Array.isArray(topics)) {
    error(`${file}: must be an array`);
    return false;
  }

  if (topics.length < 2) {
    error(`${file}: must have at least 2 topics`);
  }

  const topicIds = new Set();
  const topicTitles = new Set();
  let totalWeight = 0;
  let hasWeights = false;

  topics.forEach((topic, idx) => {
    const prefix = `${file}[${idx}]`;

    if (!topic.id) error(`${prefix}: missing 'id' field`);
    if (!topic.certificationId) error(`${prefix}: missing 'certificationId' field`);
    if (!topic.title) error(`${prefix}: missing 'title' field`);

    if (topic.certificationId !== certId) {
      error(
        `${prefix}: certificationId '${topic.certificationId}' does not match cert id '${certId}'`,
      );
    }

    if (topicIds.has(topic.id)) {
      error(`${prefix}: duplicate topic id '${topic.id}'`);
    }
    topicIds.add(topic.id);

    if (topicTitles.has(topic.title)) {
      error(`${prefix}: duplicate topic title '${topic.title}'`);
    }
    topicTitles.add(topic.title);

    // Check for weightPercentage (new schema)
    if (topic.weightPercentage !== undefined) {
      hasWeights = true;
      if (typeof topic.weightPercentage !== 'number') {
        error(`${prefix}: weightPercentage must be a number`);
      } else if (topic.weightPercentage < 0 || topic.weightPercentage > 100) {
        error(`${prefix}: weightPercentage must be between 0 and 100`);
      } else {
        totalWeight += topic.weightPercentage;
      }
    }

    // Warn about deprecated domainName field
    if (topic.domainName !== undefined) {
      warn(
        `${prefix}: 'domainName' field is deprecated. Use 'title' for domain name and add 'weightPercentage' field.`,
      );
    }
  });

  // Validate total weight
  if (hasWeights) {
    if (Math.abs(totalWeight - 100) > 0.01) {
      error(`${file}: topic weightPercentages must sum to 100% (current: ${totalWeight}%)`);
    }
  } else {
    warn(
      `${file}: topics are missing 'weightPercentage' fields. Domain weights should be specified on topics.`,
    );
  }

  return topicIds;
}

function validateSubtopics(subtopics, file, topicIds) {
  if (!subtopics || !Array.isArray(subtopics)) {
    error(`${file}: must be an array`);
    return false;
  }

  if (subtopics.length === 0) {
    warn(`${file}: no subtopics defined. Consider adding at least one subtopic per topic.`);
  }

  const subtopicIds = new Set();

  subtopics.forEach((sub, idx) => {
    const prefix = `${file}[${idx}]`;

    if (!sub.id) error(`${prefix}: missing 'id' field`);
    if (!sub.topicId) error(`${prefix}: missing 'topicId' field`);
    if (!sub.title) error(`${prefix}: missing 'title' field`);

    if (sub.topicId && !topicIds.has(sub.topicId)) {
      error(`${prefix}: topicId '${sub.topicId}' does not exist in topics.json`);
    }

    if (subtopicIds.has(sub.id)) {
      error(`${prefix}: duplicate subtopic id '${sub.id}'`);
    }
    subtopicIds.add(sub.id);
  });

  return subtopicIds;
}

function validateUnits(units, file, subtopicIds) {
  if (!units || !Array.isArray(units)) {
    error(`${file}: must be an array`);
    return new Set();
  }

  if (units.length === 0) {
    warn(`${file}: no units defined. Consider adding at least one unit per subtopic.`);
  }

  const unitIds = new Set();

  units.forEach((unit, idx) => {
    const prefix = `${file}[${idx}]`;

    if (!unit.id) error(`${prefix}: missing 'id' field`);
    if (!unit.subTopicId) error(`${prefix}: missing 'subTopicId' field`);
    if (!unit.title) error(`${prefix}: missing 'title' field`);

    if (unit.subTopicId && !subtopicIds.has(unit.subTopicId)) {
      error(`${prefix}: subTopicId '${unit.subTopicId}' does not exist in subtopics.json`);
    }

    if (unitIds.has(unit.id)) {
      error(`${prefix}: duplicate unit id '${unit.id}'`);
    }
    unitIds.add(unit.id);
  });

  // Check that every subtopic has at least one unit
  if (subtopicIds && subtopicIds.size > 0) {
    const coveredSubtopics = new Set(units.map((u) => u.subTopicId).filter(Boolean));
    const uncoveredSubtopics = [...subtopicIds].filter((id) => !coveredSubtopics.has(id));
    if (uncoveredSubtopics.length > 0) {
      warn(
        `${file}: ${uncoveredSubtopics.length} subtopic(s) have no units: ${uncoveredSubtopics.join(', ')}. Every subtopic should have at least one unit.`,
      );
    }
  }

  return unitIds;
}

function validateExamConfigs(configs, file, certId) {
  if (!configs || !Array.isArray(configs)) {
    error(`${file}: must be an array`);
    return false;
  }

  if (configs.length === 0) {
    error(`${file}: must have at least 1 exam configuration`);
  }

  configs.forEach((cfg, idx) => {
    const prefix = `${file}[${idx}]`;

    if (!cfg.id) error(`${prefix}: missing 'id' field`);
    if (!cfg.certificationId) error(`${prefix}: missing 'certificationId' field`);
    if (!cfg.name) error(`${prefix}: missing 'name' field`);

    if (cfg.certificationId !== certId) {
      error(
        `${prefix}: certificationId '${cfg.certificationId}' does not match cert id '${certId}'`,
      );
    }

    if (!VALID_STRATEGIES.has(cfg.questionSelectionStrategy)) {
      error(
        `${prefix}: invalid questionSelectionStrategy '${cfg.questionSelectionStrategy}'. Must be one of: ${Array.from(VALID_STRATEGIES).join(', ')}`,
      );
    }

    if (cfg.duration <= 0 || cfg.duration > 480) {
      error(`${prefix}: duration must be between 1 and 480 minutes`);
    }

    if (cfg.totalQuestions <= 0 || cfg.totalQuestions > 500) {
      error(`${prefix}: totalQuestions must be between 1 and 500`);
    }

    if (cfg.passingScore < 0 || cfg.passingScore > 100) {
      error(`${prefix}: passingScore must be between 0 and 100`);
    }
  });
}

function validateQuestions(questionSets, topicIds, subtopicIds, unitIds, certId) {
  if (questionSets.length === 0) {
    error('No question sets found. Must have at least questions-set-1.json');
    return;
  }

  const allQuestionIds = new Set();
  const allQuestionTexts = new Set();
  const topicCoverage = new Set();
  const unitCoverage = new Set();
  let totalQuestions = 0;
  let multipleTypeCount = 0;
  const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0 };

  questionSets.forEach(({ file, data }) => {
    if (!data) return;

    if (data.certificationId !== certId) {
      error(
        `${file}: certificationId '${data.certificationId}' does not match cert id '${certId}'`,
      );
    }

    if (!Array.isArray(data.questions)) {
      error(`${file}: 'questions' must be an array`);
      return;
    }

    if (data.questions.length < 10) {
      warn(`${file}: has only ${data.questions.length} questions. Recommended minimum is 10.`);
    }

    data.questions.forEach((q, idx) => {
      const prefix = `${file}[${idx}]`;
      totalQuestions++;

      if (!q.id) error(`${prefix}: missing 'id' field`);
      if (!q.topicId) error(`${prefix}: missing 'topicId' field`);
      if (!q.questionText) error(`${prefix}: missing 'questionText' field`);

      // unitId is the new required leaf-level FK (v3.0)
      if (!q.unitId) {
        if (q.subtopicId) {
          warn(
            `${prefix}: 'subtopicId' is deprecated. Use 'unitId' to reference a unit. The seeder will assign to the default unit for this subtopic.`,
          );
        } else {
          warn(
            `${prefix}: missing 'unitId' field. Questions should reference a unit. The seeder will assign to a default unit.`,
          );
        }
      }

      // Warn about deprecated domainId
      if (q.domainId !== undefined) {
        warn(
          `${prefix}: 'domainId' field is deprecated and will be ignored. Remove it from new questions.`,
        );
      }

      if (q.topicId && !topicIds.has(q.topicId)) {
        error(`${prefix}: topicId '${q.topicId}' does not exist in topics.json`);
      } else if (q.topicId) {
        topicCoverage.add(q.topicId);
      }

      // Validate unitId if provided
      if (q.unitId) {
        if (unitIds.size > 0 && !unitIds.has(q.unitId)) {
          error(`${prefix}: unitId '${q.unitId}' does not exist in units.json`);
        } else {
          unitCoverage.add(q.unitId);
        }
      }

      // Warn about deprecated subtopicId (still accepted for backward compat)
      if (q.subtopicId && !q.unitId) {
        if (subtopicIds && !subtopicIds.has(q.subtopicId)) {
          error(`${prefix}: subtopicId '${q.subtopicId}' does not exist in subtopics.json`);
        }
      }

      if (allQuestionIds.has(q.id)) {
        error(`${prefix}: duplicate question id '${q.id}'`);
      }
      allQuestionIds.add(q.id);

      if (allQuestionTexts.has(q.questionText)) {
        error(`${prefix}: duplicate question text`);
      }
      allQuestionTexts.add(q.questionText);

      if (!VALID_QUESTION_TYPES.has(q.questionType)) {
        error(
          `${prefix}: invalid questionType '${q.questionType}'. Must be 'single' or 'multiple'`,
        );
      }

      if (!VALID_DIFFICULTIES.has(q.difficulty)) {
        error(
          `${prefix}: invalid difficulty '${q.difficulty}'. Must be 'Easy', 'Medium', or 'Hard'`,
        );
      } else {
        difficultyCounts[q.difficulty]++;
      }

      if (!Array.isArray(q.options) || q.options.length < 4) {
        error(`${prefix}: must have at least 4 options`);
      }

      if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
        error(`${prefix}: must have at least 1 correct answer`);
      }

      if (q.questionType === 'single' && q.correctAnswers && q.correctAnswers.length !== 1) {
        error(`${prefix}: single-type questions must have exactly 1 correct answer`);
      }

      if (q.questionType === 'multiple' && q.correctAnswers && q.correctAnswers.length < 2) {
        error(`${prefix}: multiple-type questions must have at least 2 correct answers`);
      }

      if (q.questionType === 'multiple') {
        multipleTypeCount++;
      }

      if (!q.explanation || q.explanation.split(' ').length < 20) {
        warn(`${prefix}: explanation should be at least 20 words`);
      }

      if (!Array.isArray(q.tags) || q.tags.length === 0) {
        warn(`${prefix}: should have at least 1 tag`);
      }

      // Check for distractorExplanations (optional field)
      if (q.distractorExplanations) {
        if (typeof q.distractorExplanations !== 'object') {
          error(`${prefix}: distractorExplanations must be an object`);
        }
      }
    });
  });

  // Check topic coverage
  if (topicCoverage.size < topicIds.size) {
    warn(
      `Only ${topicCoverage.size} of ${topicIds.size} topics have questions. Every topic should have at least one question.`,
    );
  }

  // Check unit coverage
  if (unitIds.size > 0 && unitCoverage.size < unitIds.size) {
    warn(
      `Only ${unitCoverage.size} of ${unitIds.size} units have questions. Every unit should have at least one question.`,
    );
  }

  // Check difficulty distribution
  if (totalQuestions > 0) {
    const easyPct = (difficultyCounts.Easy / totalQuestions) * 100;
    const mediumPct = (difficultyCounts.Medium / totalQuestions) * 100;
    const hardPct = (difficultyCounts.Hard / totalQuestions) * 100;

    if (easyPct > 60 || mediumPct > 60 || hardPct > 60) {
      warn(
        `Difficulty distribution is unbalanced: Easy ${easyPct.toFixed(1)}%, Medium ${mediumPct.toFixed(1)}%, Hard ${hardPct.toFixed(1)}%. Target: 30% Easy, 45% Medium, 25% Hard.`,
      );
    }
  }

  // Check multiple-type frequency
  if (totalQuestions > 0) {
    const multiplePct = (multipleTypeCount / totalQuestions) * 100;
    if (multiplePct < 10) {
      warn(
        `Only ${multiplePct.toFixed(1)}% of questions are multiple-type. Recommended minimum is 10%.`,
      );
    }
  }
}

function validateDomains(domainsFile) {
  if (fs.existsSync(domainsFile)) {
    warn(
      `domains.json is deprecated as of migration v8-v9. Domain weights should be specified on topics using the 'weightPercentage' field. You can safely delete this file.`,
    );
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node validate-seed-data.js <path-to-cert-folder>');
    console.error('Example: node validate-seed-data.js ../gcp/gcp-ace');
    process.exit(1);
  }

  const certDir = path.resolve(args[0]);

  if (!fs.existsSync(certDir)) {
    console.error(`❌ Directory not found: ${certDir}`);
    process.exit(1);
  }

  console.log(`\n🔍 Validating seed data in: ${certDir}\n`);

  // Load all files
  const certFile = path.join(certDir, 'certification.json');
  const topicsFile = path.join(certDir, 'topics.json');
  const subtopicsFile = path.join(certDir, 'subtopics.json');
  const unitsFile = path.join(certDir, 'units.json');
  const domainsFile = path.join(certDir, 'domains.json');
  const examConfigFile = path.join(certDir, 'exam-configurations.json');

  const cert = loadJson(certFile);
  const topics = loadJson(topicsFile);
  const subtopics = loadJson(subtopicsFile);
  const units = loadJson(unitsFile);
  const examConfigs = loadJson(examConfigFile);

  // Validate certification
  if (!validateCertification(cert, 'certification.json')) {
    console.log('\n' + errors.join('\n'));
    process.exit(1);
  }

  const certId = cert.id;

  // Validate topics
  const topicIds = validateTopics(topics, 'topics.json', certId);

  // Validate subtopics
  const subtopicIds = validateSubtopics(subtopics, 'subtopics.json', topicIds);

  // Validate units (new in v3.0)
  let unitIds = new Set();
  if (!units) {
    warn(
      `units.json not found. This file is required as of v3.0 (migration v11). The seeder will auto-create default units per subtopic, but you should add units.json for proper unit-level tracking.`,
    );
  } else {
    unitIds = validateUnits(units, 'units.json', subtopicIds);
  }

  // Validate exam configurations
  validateExamConfigs(examConfigs, 'exam-configurations.json', certId);

  // Check for deprecated domains.json
  validateDomains(domainsFile);

  // Load and validate all question sets
  const questionSets = [];
  let setNum = 1;
  while (true) {
    const file = path.join(certDir, `questions-set-${setNum}.json`);
    if (!fs.existsSync(file)) break;

    const data = loadJson(file);
    questionSets.push({ file: `questions-set-${setNum}.json`, data });
    setNum++;
  }

  validateQuestions(questionSets, topicIds, subtopicIds, unitIds, certId);

  // Print results
  console.log('\n' + '='.repeat(60));

  if (errors.length > 0) {
    console.log('\n❌ VALIDATION FAILED\n');
    console.log(errors.join('\n'));
  } else {
    console.log('\n✅ VALIDATION PASSED\n');
  }

  if (warnings.length > 0) {
    console.log('\n' + warnings.join('\n'));
  }

  console.log('\n' + '='.repeat(60) + '\n');

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
