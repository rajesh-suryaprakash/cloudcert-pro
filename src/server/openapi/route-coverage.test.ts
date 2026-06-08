import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import express, { type Router } from 'express';
import { getDocument } from './registry.js';
import authRoutes from '../routes/auth.js';
import certificationRoutes from '../routes/certifications.js';
import examRoutes from '../routes/exams.js';
import srsRoutes from '../routes/srs.js';
import achievementRoutes from '../routes/achievements.js';
import studyPlanRoutes from '../routes/study-plan.js';
import { registerAuthRoutes } from './auth-routes.js';
import { registerCertificationRoutes } from './certification-routes.js';
import { registerExamRoutes } from './exam-routes.js';
import { registerTopicRoutes } from './topic-routes.js';
import { registerSubtopicRoutes } from './subtopic-routes.js';
import { registerQuestionRoutes } from './question-routes.js';
import { registerAchievementRoutes } from './achievement-routes.js';
import { registerSrsRoutes } from './srs-routes.js';
import { registerStudyPlanRoutes } from './study-plan-routes.js';
import { registerExamConfigRoutes } from './exam-config-routes.js';
import { registerSubtopicQuestionRoutes } from './subtopic-question-routes.js';

/**
 * Property Test 9: Route Coverage Completeness
 *
 * **Validates: Requirements 4.2, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 15.1**
 *
 * For all Express routes in application, assert corresponding path entry exists
 * in OpenAPI document with matching method and path.
 */
describe('Property 9: Route Coverage Completeness', () => {
  // Register all OpenAPI routes before running tests
  beforeAll(() => {
    registerAuthRoutes();
    registerCertificationRoutes();
    registerExamRoutes();
    registerExamConfigRoutes();
    registerTopicRoutes();
    registerSubtopicRoutes();
    registerQuestionRoutes();
    registerSubtopicQuestionRoutes();
    registerAchievementRoutes();
    registerSrsRoutes();
    registerStudyPlanRoutes();
  });

  /**
   * Extract all routes from an Express router
   * Returns array of { method, path } objects
   */
  function extractExpressRoutes(
    router: Router,
    basePath: string = '',
  ): Array<{ method: string; path: string }> {
    const routes: Array<{ method: string; path: string }> = [];

    // Access the router's stack (internal Express structure)
    const stack = (router as any).stack;

    if (!stack) return routes;

    for (const layer of stack) {
      if (layer.route) {
        // This is a route layer
        const routePath = basePath + layer.route.path;
        const methods = Object.keys(layer.route.methods)
          .filter((method) => layer.route.methods[method])
          .map((method) => method.toUpperCase());

        // Handle multiple paths - Express may store them as array or comma-separated string
        let paths: string[];
        if (Array.isArray(layer.route.path)) {
          // Express 4.x stores multiple paths as an array
          paths = layer.route.path.map((p: string) => basePath + p);
        } else if (typeof layer.route.path === 'string' && layer.route.path.includes(',')) {
          // Fallback: handle comma-separated paths
          paths = layer.route.path.split(',').map((p: string) => basePath + p.trim());
        } else {
          // Single path
          paths = [routePath];
        }

        for (const method of methods) {
          for (const path of paths) {
            routes.push({ method, path });
          }
        }
      } else if (layer.name === 'router' && layer.handle.stack) {
        // This is a nested router
        const nestedBasePath = layer.regexp.source
          .replace('\\/?', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace(/\^/g, '')
          .replace(/\$/g, '')
          .replace(/\\/g, '');

        routes.push(...extractExpressRoutes(layer.handle, basePath + nestedBasePath));
      }
    }

    return routes;
  }

  /**
   * Normalize Express path to OpenAPI path format
   * Converts :param to {param}
   */
  function normalizeExpressPath(path: string): string {
    return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
  }

  /**
   * Extract all routes from OpenAPI document
   * Returns array of { method, path } objects
   */
  function extractOpenAPIRoutes(): Array<{ method: string; path: string }> {
    const document = getDocument();
    const routes: Array<{ method: string; path: string }> = [];

    if (!document.paths) return routes;

    for (const [path, pathItem] of Object.entries(document.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

      for (const method of methods) {
        if (pathItem[method]) {
          routes.push({
            method: method.toUpperCase(),
            path,
          });
        }
      }
    }

    return routes;
  }

  it('should document all authentication routes in OpenAPI', () => {
    const expressRoutes = extractExpressRoutes(authRoutes, '/api');
    const openAPIRoutes = extractOpenAPIRoutes();

    // Filter to only auth routes
    const authExpressRoutes = expressRoutes.filter((r) => r.path.startsWith('/api/auth'));

    for (const expressRoute of authExpressRoutes) {
      const normalizedPath = normalizeExpressPath(expressRoute.path);
      const found = openAPIRoutes.some(
        (openAPIRoute) =>
          openAPIRoute.method === expressRoute.method && openAPIRoute.path === normalizedPath,
      );

      expect(found).toBe(true);
    }
  });

  it('should document all certification routes in OpenAPI', () => {
    const expressRoutes = extractExpressRoutes(certificationRoutes, '/api');
    const openAPIRoutes = extractOpenAPIRoutes();

    // Filter to only certification routes
    const certExpressRoutes = expressRoutes.filter(
      (r) =>
        r.path.startsWith('/api/certifications') ||
        r.path.startsWith('/api/topics') ||
        r.path.startsWith('/api/subtopics') ||
        r.path.startsWith('/api/questions') ||
        r.path.startsWith('/api/exams'),
    );

    const missingRoutes: Array<{ method: string; path: string }> = [];

    for (const expressRoute of certExpressRoutes) {
      const normalizedPath = normalizeExpressPath(expressRoute.path);
      const found = openAPIRoutes.some(
        (openAPIRoute) =>
          openAPIRoute.method === expressRoute.method && openAPIRoute.path === normalizedPath,
      );

      if (!found) {
        missingRoutes.push({ method: expressRoute.method, path: normalizedPath });
      }
    }

    if (missingRoutes.length > 0) {
      console.log('Missing certification routes:', missingRoutes);
    }

    expect(missingRoutes.length).toBe(0);
  });

  it('should document all exam routes in OpenAPI', () => {
    const expressRoutes = extractExpressRoutes(examRoutes, '/api');
    const openAPIRoutes = extractOpenAPIRoutes();

    // Filter to only exam session routes
    const examExpressRoutes = expressRoutes.filter(
      (r) =>
        r.path.startsWith('/api/exam-sessions') ||
        r.path.startsWith('/api/exams') ||
        r.path.startsWith('/api/attempts'),
    );

    const missingRoutes: Array<{ method: string; path: string }> = [];

    for (const expressRoute of examExpressRoutes) {
      const normalizedPath = normalizeExpressPath(expressRoute.path);
      const found = openAPIRoutes.some(
        (openAPIRoute) =>
          openAPIRoute.method === expressRoute.method && openAPIRoute.path === normalizedPath,
      );

      if (!found) {
        missingRoutes.push({ method: expressRoute.method, path: normalizedPath });
      }
    }

    if (missingRoutes.length > 0) {
      console.log('Missing exam routes:', missingRoutes);
    }

    expect(missingRoutes.length).toBe(0);
  });

  it('should document all SRS routes in OpenAPI', () => {
    const expressRoutes = extractExpressRoutes(srsRoutes, '/api/srs');
    const openAPIRoutes = extractOpenAPIRoutes();

    for (const expressRoute of expressRoutes) {
      const normalizedPath = normalizeExpressPath(expressRoute.path);
      const found = openAPIRoutes.some(
        (openAPIRoute) =>
          openAPIRoute.method === expressRoute.method && openAPIRoute.path === normalizedPath,
      );

      expect(found).toBe(true);
    }
  });

  it('should document all achievement routes in OpenAPI', () => {
    const expressRoutes = extractExpressRoutes(achievementRoutes, '/api/achievements');
    const openAPIRoutes = extractOpenAPIRoutes();

    const missingRoutes: Array<{ method: string; path: string }> = [];

    for (const expressRoute of expressRoutes) {
      const normalizedPath = normalizeExpressPath(expressRoute.path);
      const found = openAPIRoutes.some(
        (openAPIRoute) =>
          openAPIRoute.method === expressRoute.method && openAPIRoute.path === normalizedPath,
      );

      if (!found) {
        missingRoutes.push({ method: expressRoute.method, path: normalizedPath });
      }
    }

    if (missingRoutes.length > 0) {
      console.log('Missing achievement routes:', missingRoutes);
    }

    expect(missingRoutes.length).toBe(0);
  });

  it('should document all study plan routes in OpenAPI', () => {
    const expressRoutes = extractExpressRoutes(studyPlanRoutes, '/api');
    const openAPIRoutes = extractOpenAPIRoutes();

    // Filter to only study plan routes
    const studyPlanExpressRoutes = expressRoutes.filter((r) => r.path.includes('study-plan'));

    for (const expressRoute of studyPlanExpressRoutes) {
      const normalizedPath = normalizeExpressPath(expressRoute.path);
      const found = openAPIRoutes.some(
        (openAPIRoute) =>
          openAPIRoute.method === expressRoute.method && openAPIRoute.path === normalizedPath,
      );

      expect(found).toBe(true);
    }
  });

  /**
   * Property-based test: For any subset of routes, all should be documented
   */
  it('Property 9: all Express routes have corresponding OpenAPI documentation', () => {
    // Collect all Express routes from all routers
    const allExpressRoutes = [
      ...extractExpressRoutes(authRoutes, '/api'),
      ...extractExpressRoutes(certificationRoutes, '/api'),
      ...extractExpressRoutes(examRoutes, '/api'),
      ...extractExpressRoutes(srsRoutes, '/api/srs'),
      ...extractExpressRoutes(achievementRoutes, '/api/achievements'),
      ...extractExpressRoutes(studyPlanRoutes, '/api'),
    ];

    const openAPIRoutes = extractOpenAPIRoutes();

    fc.assert(
      fc.property(fc.constantFrom(...allExpressRoutes), (expressRoute) => {
        const normalizedPath = normalizeExpressPath(expressRoute.path);

        const found = openAPIRoutes.some(
          (openAPIRoute) =>
            openAPIRoute.method === expressRoute.method && openAPIRoute.path === normalizedPath,
        );

        // If not found, provide helpful error message
        if (!found) {
          console.error(
            `Missing OpenAPI documentation for ${expressRoute.method} ${normalizedPath}`,
          );
        }

        return found;
      }),
      { numRuns: allExpressRoutes.length }, // Test each route at least once
    );
  });

  /**
   * Additional check: Ensure we have comprehensive coverage
   */
  it('should have at least 40 documented endpoints', () => {
    const openAPIRoutes = extractOpenAPIRoutes();
    expect(openAPIRoutes.length).toBeGreaterThanOrEqual(40);
  });

  /**
   * Verify no duplicate routes in OpenAPI document
   */
  it('should not have duplicate routes in OpenAPI document', () => {
    const openAPIRoutes = extractOpenAPIRoutes();
    const routeKeys = openAPIRoutes.map((r) => `${r.method} ${r.path}`);
    const uniqueRouteKeys = new Set(routeKeys);

    expect(routeKeys.length).toBe(uniqueRouteKeys.size);
  });
});
