import { Router, type Request, type Response, type NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { getDocument, validateDocument } from './registry.js';
import { logger } from '../logger.js';

// Cache for the generated OpenAPI document and its JSON string
let cachedDocument: ReturnType<typeof getDocument> | null = null;
let cachedJsonString: string | null = null;
let cachedJsonBuffer: Buffer | null = null;

/**
 * Get the cached OpenAPI document, generating it on first call
 * Document is cached in memory and only regenerated on server restart
 * Requirements: 11.1, 11.2
 */
async function getCachedOpenAPIDocument() {
  if (!cachedDocument) {
    try {
      const document = getDocument();
      await validateDocument(document);
      cachedDocument = document;

      // Pre-compute and cache the JSON string and buffer for fast serving
      cachedJsonString = JSON.stringify(document);
      cachedJsonBuffer = Buffer.from(cachedJsonString, 'utf8');

      logger.info('OpenAPI document generated and cached');
    } catch (error) {
      logger.error('Failed to generate OpenAPI document', error);
      throw error;
    }
  }
  return {
    document: cachedDocument,
    jsonString: cachedJsonString as string,
    jsonBuffer: cachedJsonBuffer as Buffer,
  };
}

/**
 * GET /api-docs/openapi.json
 * Returns the cached OpenAPI 3.0 specification as JSON
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5
 */
async function serveOpenAPISpec(req: Request, res: Response): Promise<void> {
  try {
    const { jsonString, jsonBuffer } = await getCachedOpenAPIDocument();

    // CORS headers are already applied by the cors middleware in server.ts
    // Requirement: 6.3

    // Set status code first
    res.statusCode = 200;

    // Remove X-Powered-By header if present
    res.removeHeader('X-Powered-By');

    // Set Content-Type to exactly "application/json" without charset
    // Requirement: 6.2
    // We need to use writeHead to prevent Express from modifying headers
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': jsonBuffer.length.toString(),
    });

    // Write directly and end
    res.end(jsonString);
  } catch (error) {
    logger.error('Error serving OpenAPI specification', error);
    res.status(500).json({
      error: 'Failed to generate OpenAPI specification',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Configure Swagger UI options
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
function getSwaggerUIOptions() {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return {
    // Fetch spec from /api-docs/openapi.json
    // Requirement: 5.2
    url: '/api-docs/openapi.json',

    // Enable "Try it out" functionality
    // Requirement: 5.4
    swaggerOptions: {
      tryItOutEnabled: true,
      // Support authentication in Swagger UI
      // Requirement: 5.5, 5.6
      persistAuthorization: true,
      // Allow credentials (cookies) to be sent with requests
      requestInterceptor: (request: Record<string, unknown>) => {
        request.credentials = 'include';
        return request;
      },
    },

    // Use CDN URLs for Swagger UI assets in production
    // Requirement: 5.3
    customCss: isDevelopment
      ? undefined
      : 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui.css',
    customJs: isDevelopment
      ? undefined
      : 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui.bundle.js',
  };
}

/**
 * Middleware to handle Swagger UI errors
 * Requirement: 13.6
 */
function handleSwaggerUIErrors(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err) {
    // Log error with CSP violation details if applicable
    // Requirement: 13.6
    const cspViolation = req.headers['content-security-policy-report-only']
      ? ' (CSP violation detected)'
      : '';

    logger.error(`Swagger UI error${cspViolation}:`, err);

    // Display user-friendly error message in browser
    // Requirement: 13.6
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>API Documentation Error</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .error-container { background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 4px; }
            h1 { color: #721c24; }
            p { color: #721c24; }
            .details { background: #fff; padding: 10px; margin-top: 10px; border-left: 3px solid #721c24; }
            code { background: #f5f5f5; padding: 2px 6px; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>API Documentation Unavailable</h1>
            <p>The API documentation failed to load. This may be due to:</p>
            <ul>
              <li>Content Security Policy (CSP) restrictions</li>
              <li>Network connectivity issues</li>
              <li>Server configuration problems</li>
            </ul>
            <div class="details">
              <strong>Error:</strong> <code>${err instanceof Error ? err.message : 'Unknown error'}</code>
            </div>
            <p>Please try refreshing the page or contact your system administrator.</p>
          </div>
        </body>
      </html>
    `);
  } else {
    _next();
  }
}

// Create router for documentation endpoints
const router = Router();

// Mount the OpenAPI JSON endpoint with explicit priority
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5, 11.1, 11.2
// This MUST be registered before swaggerUi middleware to prevent interception
router.get('/openapi.json', async (req: Request, res: Response, _next: NextFunction) => {
  // Explicitly handle this route and don't pass to next middleware
  await serveOpenAPISpec(req, res);
});

// Mount Swagger UI at /api-docs root
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 11.3, 13.6
// Use a more specific route pattern to avoid catching /openapi.json
router.get('/', swaggerUi.serve[0], (req: Request, res: Response, next: NextFunction) => {
  try {
    swaggerUi.setup(null, getSwaggerUIOptions())(req, res, next);
  } catch (error) {
    handleSwaggerUIErrors(error, req, res, next);
  }
});

export default router;
