import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import { z, type ZodSchema } from 'zod';
import { logger } from '../logger.js';
import { validateOpenAPISpec } from './validator.js';

/**
 * OpenAPI Registry Module
 *
 * This module manages the OpenAPI 3.0 specification generation for CloudCert Pro.
 * It provides functions to register Zod schemas as reusable components and API routes
 * with complete OpenAPI metadata.
 *
 * Registry Initialization Parameters:
 * - API_TITLE: Display name for the API in documentation
 * - API_VERSION: Semantic version of the API (used for SDK generation)
 * - API_DESCRIPTION: Human-readable description of the API
 * - servers: Array of server URLs (development and production)
 * - tags: Logical groupings for organizing endpoints in documentation
 * - securitySchemes: Authentication methods (cookieAuth, bearerAuth)
 *
 * Best Practices:
 * 1. Register all Zod schemas as components before registering routes
 * 2. Use descriptive component names in PascalCase (e.g., 'CreateUserRequest')
 * 3. Add .describe() to all Zod fields for field-level documentation
 * 4. Add .openapi() to schemas for schema-level metadata (description, example)
 * 5. Always include error response schemas (400, 401, 403, 404, 500)
 * 6. Use consistent tags across related endpoints for better organization
 * 7. Validate schemas before registering to catch errors early
 */

// Extend Zod with OpenAPI methods for schema documentation
extendZodWithOpenApi(z);

/**
 * Initialize OpenAPI Registry
 *
 * The registry is the central component that manages:
 * - Schema component registration and reuse
 * - Route path registration with OpenAPI metadata
 * - OpenAPI document generation
 *
 * The registry is created once at module load time and reused throughout
 * the application lifecycle.
 */
const registry = new OpenAPIRegistry();

/**
 * Track registered operation IDs to detect duplicates
 *
 * Each route must have a unique operationId for SDK generation and
 * API client identification. This map ensures no duplicates are registered.
 */
const registeredOperationIds = new Map<string, string>();

/** Track registered component names to validate $ref references */
const registeredComponentNames = new Set<string>();

/**
 * API Metadata Configuration
 *
 * These constants define the top-level metadata for the OpenAPI document.
 * They appear in the Swagger UI header and are used by SDK generators.
 */
const API_TITLE = 'CloudCert Pro API';
const API_VERSION = '1.0.0';
const API_DESCRIPTION = 'Cloud certification exam preparation platform API';

/**
 * Server URLs Configuration
 *
 * Defines the base URLs where the API is available. The OpenAPI document
 * includes both development and production URLs so clients can switch
 * between environments.
 *
 * In production, only the production URL should be included.
 * In development, both URLs allow testing against different environments.
 */
const servers = [
  {
    url: 'http://localhost:3000',
    description: 'Development',
  },
  {
    url: 'https://api.cloudcert.pro',
    description: 'Production',
  },
];

/**
 * Security Schemes Registration
 *
 * Defines the authentication methods supported by the API:
 *
 * 1. cookieAuth: JWT token stored in httpOnly cookie
 *    - Used by browser-based clients (React SPA)
 *    - Automatically sent with requests (credentials: include)
 *    - Protected against CSRF attacks
 *
 * 2. bearerAuth: JWT token in Authorization header
 *    - Used by mobile apps and backend services
 *    - Requires explicit header inclusion
 *    - Suitable for non-browser clients
 *
 * Routes reference these schemes using:
 *   security: [{ cookieAuth: [] }]  // for cookie-based auth
 *   security: [{ bearerAuth: [] }]  // for bearer token auth
 */
registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'token',
  description: 'JWT token stored in httpOnly cookie',
});

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT token in Authorization header',
});

/**
 * API Tags Configuration
 *
 * Tags organize endpoints into logical groups in the Swagger UI.
 * Each tag should represent a domain or feature area.
 *
 * When registering routes, assign them to one or more tags:
 *   tags: ['Authentication', 'Users']
 *
 * This helps users navigate the documentation and understand
 * the API structure at a glance.
 */
const tags = [
  { name: 'Authentication', description: 'User authentication and authorization endpoints' },
  { name: 'Certifications', description: 'Certification management endpoints' },
  { name: 'Exams', description: 'Exam session and configuration endpoints' },
  { name: 'Topics', description: 'Topic and subtopic management endpoints' },
  { name: 'Subtopics', description: 'Subtopic management endpoints' },
  { name: 'Questions', description: 'Question management endpoints' },
  { name: 'Achievements', description: 'User achievement tracking endpoints' },
  { name: 'SRS', description: 'Spaced Repetition System endpoints' },
  { name: 'Study Plan', description: 'Study plan and progress tracking endpoints' },
  { name: 'Question History', description: 'Question history tracking and management endpoints' },
];

/**
 * Check if a Zod schema contains unsupported types
 *
 * Validates that the schema can be converted to OpenAPI format.
 * Throws an error if unsupported types are detected.
 *
 * Supported types:
 * - ZodObject: Object with properties
 * - ZodString: String with optional constraints (min, max, email, uuid, etc.)
 * - ZodNumber: Number with optional constraints (min, max, int)
 * - ZodBoolean: Boolean values
 * - ZodArray: Arrays with element type
 * - ZodUnion: Union types (converted to oneOf)
 * - ZodEnum: Enumerated values
 * - ZodLiteral: Literal values
 *
 * Unsupported types:
 * - ZodFunction: Function types cannot be serialized
 * - ZodPromise: Promise types are not serializable
 * - ZodLazy: Lazy evaluation is not supported
 *
 * Requirement: 13.1
 */
function validateZodSchema(name: string, schema: ZodSchema): void {
  try {
    // Check for unsupported types by attempting to convert
    const schemaType =
      (schema as unknown as { _def?: { typeName?: string }; constructor: { name: string } })._def
        ?.typeName || (schema as unknown as { constructor: { name: string } }).constructor.name;

    // List of unsupported types that zod-to-openapi cannot handle
    const unsupportedTypes = ['ZodFunction', 'ZodPromise', 'ZodLazy'];

    if (unsupportedTypes.includes(schemaType)) {
      throw new Error(
        `Unsupported Zod type in schema "${name}": ${schemaType}. ` +
          `Supported types: ZodObject, ZodString, ZodNumber, ZodBoolean, ZodArray, ZodUnion, ZodEnum, ZodLiteral`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unsupported')) {
      throw error;
    }
    logger.warn({ err: error }, `Could not fully validate schema "${name}" type`);
  }
}

/**
 * Register a Zod schema as a reusable OpenAPI component
 *
 * Schema Registration Best Practices:
 *
 * 1. Component Naming:
 *    - Use PascalCase names (e.g., 'CreateUserRequest', 'UserResponse')
 *    - Include Request/Response suffix for clarity
 *    - Use domain-specific names (e.g., 'ExamSession', 'QuestionAnswer')
 *
 * 2. Schema Documentation:
 *    - Add .describe() to every field for field-level documentation
 *    - Add .openapi() to the schema for schema-level metadata
 *    - Include examples that show realistic data
 *    - Document constraints (min, max, pattern, etc.)
 *
 * 3. Reusability:
 *    - Register common schemas once and reuse via $ref
 *    - Reduces OpenAPI document size
 *    - Ensures consistency across endpoints
 *    - Makes schema updates easier (single source of truth)
 *
 * 4. Error Schemas:
 *    - Always register error response schemas
 *    - Include ValidationErrorResponse, UnauthorizedErrorResponse, etc.
 *    - Document error conditions in route descriptions
 *
 * Example:
 *   const UserSchema = z.object({
 *     id: z.string().uuid().describe('Unique user ID'),
 *     email: z.string().email().describe('User email address'),
 *     role: z.enum(['user', 'admin']).describe('User role')
 *   }).openapi({
 *     description: 'User account information',
 *     example: { id: '...', email: 'user@example.com', role: 'user' }
 *   });
 *   registerComponent('User', UserSchema);
 *
 * @param name - Component name (should be PascalCase)
 * @param schema - Zod schema to register
 * Requirement: 13.1
 */
export function registerComponent(name: string, schema: ZodSchema): void {
  validateZodSchema(name, schema);
  registry.register(name, schema);
  registeredComponentNames.add(name);
}

/**
 * Register an API route with OpenAPI metadata
 *
 * Route Registration Patterns:
 *
 * 1. Basic Route Structure:
 *    - method: HTTP method (get, post, put, delete, patch)
 *    - path: Express route path (e.g., '/api/users/:id')
 *    - summary: One-line description (appears in endpoint list)
 *    - description: Detailed description (appears in endpoint details)
 *    - tags: Array of tag names for organization
 *
 * 2. Request Documentation:
 *    - params: Path parameters (e.g., :id, :certId)
 *    - query: Query string parameters
 *    - body: Request body with schema and content type
 *
 * 3. Response Documentation:
 *    - Document all possible response codes (200, 201, 400, 401, 403, 404, 500)
 *    - Include response schema and description for each code
 *    - Use registered component schemas via $ref
 *
 * 4. Security Requirements:
 *    - security: [{ cookieAuth: [] }] for authenticated routes
 *    - Omit security field for public routes
 *    - Document which roles are required (admin, user, etc.)
 *
 * 5. Error Responses:
 *    - 400: ValidationError - invalid request body or parameters
 *    - 401: UnauthorizedError - authentication required or failed
 *    - 403: ForbiddenError - user lacks permission (e.g., not admin)
 *    - 404: NotFoundError - resource not found
 *    - 500: Internal server error (generic error response)
 *
 * Example:
 *   registerPath({
 *     method: 'post',
 *     path: '/api/users',
 *     summary: 'Create a new user',
 *     description: 'Create a new user account with email and password',
 *     tags: ['Users'],
 *     request: {
 *       body: {
 *         content: {
 *           'application/json': { schema: CreateUserSchema }
 *         }
 *       }
 *     },
 *     responses: {
 *       201: {
 *         description: 'User created successfully',
 *         content: {
 *           'application/json': { schema: UserSchema }
 *         }
 *       },
 *       400: {
 *         description: 'Invalid request body',
 *         content: {
 *           'application/json': { schema: ValidationErrorResponseSchema }
 *         }
 *       }
 *     }
 *   });
 *
 * Requirements: 13.2, 13.3
 */
export function registerPath(config: RouteConfig): void {
  // Check for duplicate operation IDs
  // Each route must have a unique operationId for SDK generation
  // Requirement: 13.2
  if (config.operationId) {
    const existingPath = registeredOperationIds.get(config.operationId);
    if (existingPath) {
      throw new Error(
        `Duplicate operation ID "${config.operationId}" detected. ` +
          `First registered at path "${existingPath}", now attempting to register at path "${config.path}". ` +
          `Each operation ID must be unique across all routes.`,
      );
    }
    registeredOperationIds.set(config.operationId, config.path);
  }

  // Check for unregistered schema component references
  // All $ref references must point to registered components
  // Requirement: 13.3
  if (config.request?.body?.content?.['application/json']?.schema) {
    validateSchemaReferences(
      config.request.body.content['application/json'].schema as Record<string, unknown>,
      config.path,
    );
  }

  if (config.responses) {
    Object.values(config.responses).forEach((response) => {
      const responseContent = (
        response as { content?: { 'application/json'?: { schema?: unknown } } }
      ).content;
      if (responseContent?.['application/json']?.schema) {
        validateSchemaReferences(
          responseContent['application/json'].schema as Record<string, unknown>,
          config.path,
        );
      }
    });
  }

  registry.registerPath(config);
}

/**
 * Validate that all schema references are registered components
 *
 * This function recursively checks all schema references ($ref) in a route
 * to ensure they point to registered components. This prevents broken
 * references in the OpenAPI document.
 *
 * Checks:
 * - Direct $ref references to components
 * - Nested properties in object schemas
 * - Array item schemas
 * - Union types (oneOf)
 * - Intersection types (allOf)
 *
 * Requirement: 13.3
 */
function validateSchemaReferences(schema: Record<string, unknown>, routePath: string): void {
  if (!schema) return;

  // Check if this is a reference to a component
  if (schema.$ref) {
    const componentName = (schema.$ref as string).split('/').pop();
    if (componentName && !registeredComponentNames.has(componentName)) {
      throw new Error(
        `Route "${routePath}" references unregistered schema component "${componentName}". ` +
          `Please register this component using registerComponent() before registering the route.`,
      );
    }
  }

  // Recursively check nested schemas
  if (schema.properties) {
    Object.values(schema.properties as Record<string, unknown>).forEach((prop) => {
      validateSchemaReferences(prop as Record<string, unknown>, routePath);
    });
  }

  if (schema.items) {
    validateSchemaReferences(schema.items as Record<string, unknown>, routePath);
  }

  if (schema.oneOf) {
    (schema.oneOf as unknown[]).forEach((option) => {
      validateSchemaReferences(option as Record<string, unknown>, routePath);
    });
  }

  if (schema.allOf) {
    (schema.allOf as unknown[]).forEach((option) => {
      validateSchemaReferences(option as Record<string, unknown>, routePath);
    });
  }
}

/**
 * Generate the complete OpenAPI 3.0 document
 *
 * This function creates the final OpenAPI specification document that includes:
 * - API metadata (title, version, description)
 * - Server URLs (development and production)
 * - All registered paths (routes)
 * - All registered components (schemas, security schemes)
 * - All defined tags
 *
 * The document is generated once at server startup and cached in memory
 * for performance. It is served at /api-docs/openapi.json and used by:
 * - Swagger UI for interactive documentation
 * - SDK generators for client code generation
 * - API validators and testing tools
 *
 * @returns OpenAPI 3.0 document object
 * Requirement: 13.4
 */
export function getDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  const document = generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: API_TITLE,
      version: API_VERSION,
      description: API_DESCRIPTION,
    },
    servers,
    tags,
  });

  return document;
}

/**
 * Validate the generated OpenAPI document
 *
 * Validates that the generated OpenAPI document conforms to the OpenAPI 3.0
 * specification. This catches errors in schema definitions, route metadata,
 * and component references before the document is served.
 *
 * Validation checks:
 * - All required fields are present
 * - All schema references are valid
 * - All security schemes are defined
 * - All paths are properly formatted
 * - All response codes are valid HTTP status codes
 *
 * If validation fails, detailed error messages are logged to help identify
 * the issue. Common errors:
 * - Missing required fields in schema definitions
 * - Invalid $ref paths
 * - Undefined security schemes
 * - Malformed path parameters
 *
 * @param document - OpenAPI document to validate
 * Requirement: 13.4
 */
export async function validateDocument(document: Record<string, unknown>) {
  // Validate the generated document against OpenAPI 3.0 spec
  // Requirement: 13.4
  const validationResult = await validateOpenAPISpec(document);

  if (!validationResult.valid) {
    logger.error('Generated OpenAPI document failed validation:');
    validationResult.errors?.forEach((error: { message: string }) => {
      logger.error(`  - ${error.message}`);
    });
    throw new Error('Generated OpenAPI document failed validation. See logs for details.');
  }

  return document;
}

// Export registry instance for direct access if needed
export { registry };
