# Certification Seed Data Template

**Version 3.0 | Technical Documentation**

Use this template to bootstrap a new certification exam. Copy the `my-cert-slug/`
folder, rename it to your cert's slug, and fill in the data.

---

## 🎯 Choose Your Documentation Path

### 👔 **Enterprise Users** (Managers, Coordinators, Non-Technical Staff)
**Start here:** [README-ENTERPRISE.md](README-ENTERPRISE.md) - Enterprise overview, workflows, governance

### 🎓 **Content Creators** (Certification Coordinators, Content Managers)
**Start here:** [ADMIN-GUIDE.md](ADMIN-GUIDE.md) - Complete step-by-step guide for adding certifications

### 💻 **Developers** (Technical Staff, DevOps)
**Start here:** This document (you are here) - Technical documentation and architecture

### 🔍 **Quick Reference** (All Users)
**Start here:** [QUICK-REFERENCE.md](QUICK-REFERENCE.md) - Field definitions and validation rules

---

## 📚 Complete Documentation Index

| Document | Audience | Purpose | Time |
|----------|----------|---------|------|
| **[README-ENTERPRISE.md](README-ENTERPRISE.md)** | Enterprise | Overview, workflows, governance | 10 min |
| **[ADMIN-GUIDE.md](ADMIN-GUIDE.md)** | Non-technical | Step-by-step configuration guide | 30 min |
| **[README.md](README.md)** | Developers | Technical documentation (you are here) | 20 min |
| **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** | All | Field reference and validation rules | 5 min |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Technical | System architecture and data flow | 15 min |
| **[MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)** | Technical | Schema migration instructions | 15 min |
| **[CHANGELOG.md](CHANGELOG.md)** | All | Version history | 5 min |
| **[UPDATE-SUMMARY.md](UPDATE-SUMMARY.md)** | All | Latest version highlights | 5 min |

## 🚀 Quick Start

```bash
# 1. Copy template
cp -r certificate-seeder-json-template/my-cert-slug gcp/my-new-cert

# 2. Update files with your data
# Edit: certification.json, topics.json, subtopics.json, units.json, questions-set-1.json

# 3. Validate
node certificate-seeder-json-template/validate-seed-data.js gcp/my-new-cert

# 4. Seed
rm cloudcert.db cloudcert.db-shm cloudcert.db-wal
npm run dev
```

---

## Entity Hierarchy & FK Chain

```
certifications
  └── exam_configurations   (certificationId → certifications.id)
  └── topics                (certificationId → certifications.id)
        ├── weightPercentage (domain weight stored directly on topic)
        ├── docUrl          (optional documentation URL)
        └── subtopics       (topicId → topics.id)
              └── units     (subTopicId → subtopics.id)  ⭐ NEW in v3.0
                    └── questions (topicId → topics.id, unitId → units.id)
```

**IMPORTANT SCHEMA CHANGES (Migration v11):**

- A new **Units** level has been added between Subtopics and Questions
- Questions now reference `unitId` (FK → units.id) instead of `subtopicId`
- `subtopicId` on questions is preserved for backward compatibility but `unitId` is the primary FK
- `units.json` is now a required file in every cert folder
- The seeder auto-creates a default "General" unit per subtopic for existing data

The seeder converts every slug ID to a deterministic UUID v5 before writing to
the DB. You never need to generate UUIDs manually — just use readable slugs.

---

## File Checklist

```
<your-cert-slug>/
  certification.json        ← 1 object
  exam-configurations.json  ← array, min 1 (recommend 3 — one per question set)
  topics.json               ← array, min 2 (topics = exam domains with weightPercentage)
  subtopics.json            ← array, min 1 per topic
  units.json                ← array, min 1 per subtopic  ⭐ NEW in v3.0
  questions-set-1.json      ← min 10 questions (questions reference unitId)
  questions-set-2.json      ← min 10 questions (optional but recommended)
  questions-set-3.json      ← min 10 questions (optional but recommended)

  domains.json              ← DEPRECATED (kept for backward compatibility only)
```

---

## Slug Naming Conventions

| Entity        | Pattern                                    | Example                                    |
| ------------- | ------------------------------------------ | ------------------------------------------ |
| Certification | `<vendor>-<abbrev>`                        | `aws-saa`, `az-900`                        |
| Exam Config   | `exam-config-<cert-slug>-s<N>`             | `exam-config-aws-saa-s1`                   |
| Topic         | `topic-<cert-abbrev>-<domain>`             | `topic-saa-storage`                        |
| Subtopic      | `sub-<cert-abbrev>-<area>`                 | `sub-saa-s3`                               |
| Unit          | `unit-<cert-abbrev>-<subtopic>-<concept>`  | `unit-saa-s3-storage-classes`  ⭐ NEW      |
| Question      | `q-<cert-abbrev>-s<N>-<NNN>`              | `q-saa-s1-001`                             |

**Note:** Domain slugs are deprecated. Topics now represent domains directly.

---

## How Units Map to Exam Guides

Units capture the granular bullet-point considerations listed under each subtopic
in official exam guides. For example:

```
Topic (Domain):    "Section 1: Designing and planning a cloud solution architecture (~25%)"
Subtopic:          "1.1 Designing a cloud solution infrastructure that meets business requirements"
Units (bullets):   ● Business use cases and product strategy
                   ● Identifying functional and non-functional requirements
                   ● Business continuity plan
                   ● Cost optimization
                   ● Supporting the application design
                   ● Integration patterns with external systems
                   ● Movement of data
                   ● Design decision trade-offs
                   ● Workload disposition strategies
                   ● Success measurements (KPI, ROI, metrics)
                   ● Security and compliance
                   ● Observability
```

Each bullet point becomes one Unit. Questions are then mapped to the specific
Unit they test, enabling granular performance tracking at the unit level.

---

## Question Quality Rules

| Rule                         | Requirement                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| Minimum options              | 4 per question                                                |
| Single-type correctAnswers   | Exactly 1 entry                                               |
| Multiple-type correctAnswers | 2 or more entries, all present in `options`                   |
| Explanation length           | Minimum ~20 words — explain correct AND wrong answers         |
| Difficulty distribution      | No tier > 60% per set. Target: 30% Easy / 45% Med / 25% Hard  |
| Multiple-type frequency      | At least 10% of questions per set                             |
| Topic coverage               | Every topic must have at least 1 question across all sets     |
| Unit coverage                | Every unit should have at least 1 question across all sets    |
| ID uniqueness                | No duplicate IDs or question texts within a cert              |
| Tags                         | At least 1 tag per question (service name or concept)         |
| Distractor explanations      | Optional but recommended: explain why wrong answers are wrong |

---

## Steps to Add a New Certification

1. Copy this folder: `cp -r certificate-seeder-json-template/my-cert-slug <vendor>-<abbrev>`
2. Rename all `my-cert-slug` references inside the JSON files to your new slug
3. Update `certification.json` with real vendor data
4. Define your topics in `topics.json` (use the official exam guide domains)
   - **IMPORTANT:** Set `weightPercentage` on each topic (must sum to 100%)
   - Optionally add `docUrl` for documentation links
5. Define subtopics in `subtopics.json` (one per major sub-area per topic)
6. **NEW:** Define units in `units.json` (one per bullet-point consideration per subtopic)
   - Map each unit to its parent subtopic via `subTopicId`
   - Use the official exam guide bullet points as unit titles
7. Write questions in `questions-set-1.json` (min 10, aim for 12+)
   - **IMPORTANT:** Use `unitId` (not `subtopicId`) as the leaf-level FK on questions
   - `topicId` is still required on questions for question selection strategy performance
   - Optionally add `distractorExplanations` for better learning experience
8. Delete `domains.json` (deprecated, no longer used)
9. Reset the DB and restart the server — the seeder auto-discovers the new folder

```bash
# Reset DB and reseed
rm cloudcert.db cloudcert.db-shm cloudcert.db-wal
npm run dev
```

---

## Migration Notes (v11 — Units Layer)

**What Changed:**

- New `units` table added between subtopics and questions
- `questions.unitId` is the new leaf-level FK (replaces `questions.subTopicId` as primary mapping)
- `questions.subTopicId` is preserved for backward compatibility
- `questions.topicId` is preserved and still required for question selection strategy

**Backward Compatibility:**

- Existing questions without `unitId` are automatically assigned to a default "General" unit
  created for each subtopic during migration v11
- The seeder accepts questions with `subtopicId` (old format) and maps them to the default unit
- New questions should use `unitId` directly

**New Features:**

- Unit-level performance tracking in the Insight Dashboard
- Subtopic → Unit drill-down in the Knowledge Gap Heatmap
- Unit filter in the Questions admin panel
- Unit-scoped question selection via `POST /questions/select` with `scope: 'unit'`

---

## Migration Notes (v8-v9 — Domain Weights)

**Breaking Changes:**

- `domain_weights` table is deprecated
- Domain weights now stored on `topics.weightPercentage`
- `domainId` field on questions is deprecated (still accepted for backward compatibility)
- `domains.json` file is no longer processed by the seeder

**Backward Compatibility:**

- Existing seed data with `domains.json` will continue to work
- Migration v8 automatically migrates domain weights to topics
- Questions with `domainId` will still seed successfully (field is ignored)

**New Features:**

- Topics can have optional `docUrl` field for documentation links
- Questions can have optional `distractorExplanations` field for enhanced learning
