import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { validateOpenAPISpec } from '../src/server/openapi/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

/**
 * Parse error output and suggest fixes for common errors
 * Requirement: 13.5
 */
function suggestFixForError(errorOutput: string): string {
  const suggestions: Array<[RegExp, string]> = [
    [
      /command not found|not recognized/i,
      'openapi-generator-cli is not installed. Install it with: npm install -g @openapitools/openapi-generator-cli',
    ],
    [
      /invalid spec|validation failed/i,
      'The OpenAPI specification is invalid. Check the spec file for syntax errors or missing required fields.',
    ],
    [
      /template not found|generator not found/i,
      'The specified generator is not available. Ensure openapi-generator-cli is properly installed.',
    ],
    [
      /permission denied/i,
      'Permission denied. Check file permissions or try running with elevated privileges.',
    ],
    [
      /ENOENT|no such file/i,
      'Input file not found. Ensure the OpenAPI spec file exists at the specified path.',
    ],
  ];

  for (const [pattern, suggestion] of suggestions) {
    if (pattern.test(errorOutput)) {
      return suggestion;
    }
  }

  return 'Check the error output above and ensure all dependencies are installed.';
}

/**
 * Validate OpenAPI spec before generation
 * Requirements: 7.1, 7.5
 */
async function validateSpec(specPath: string): Promise<boolean> {
  try {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    const result = await validateOpenAPISpec(spec);

    if (!result.valid) {
      console.error('OpenAPI specification validation failed:');
      result.errors?.forEach((error: any) => {
        console.error(`  - ${error.message}`);
      });
      return false;
    }

    console.log('✓ OpenAPI specification is valid');
    return true;
  } catch (error) {
    console.error(
      'Failed to validate OpenAPI spec:',
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Generate TypeScript SDK using openapi-generator-cli
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 13.5
 */
async function generateTypeScriptSDK(specPath: string, outputDir: string): Promise<boolean> {
  try {
    console.log('Generating TypeScript SDK...');

    const command = [
      'openapi-generator-cli generate',
      `-i ${specPath}`,
      `-g typescript-fetch`,
      `-o ${outputDir}`,
      '--additional-properties=npmName=@cloudcert/api-client',
      '--additional-properties=supportsES6=true',
      '--additional-properties=withInterfaces=true',
    ].join(' ');

    execSync(command, { stdio: 'inherit', cwd: projectRoot });
    console.log(`✓ TypeScript SDK generated successfully at ${outputDir}`);
    return true;
  } catch (error) {
    // Display generator error output
    // Requirement: 13.5
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ TypeScript SDK generation failed');
    console.error('Error output:', errorMessage);

    // Suggest fixes for common errors
    // Requirement: 13.5
    const suggestion = suggestFixForError(errorMessage);
    console.error('\nSuggestion:', suggestion);

    return false;
  }
}

/**
 * Generate JavaScript SDK using openapi-generator-cli
 * Requirements: 7.1, 7.5, 7.6, 13.5
 */
async function generateJavaScriptSDK(specPath: string, outputDir: string): Promise<boolean> {
  try {
    console.log('Generating JavaScript SDK...');

    const command = [
      'openapi-generator-cli generate',
      `-i ${specPath}`,
      `-g javascript`,
      `-o ${outputDir}`,
      '--additional-properties=npmName=@cloudcert/api-client',
    ].join(' ');

    execSync(command, { stdio: 'inherit', cwd: projectRoot });
    console.log(`✓ JavaScript SDK generated successfully at ${outputDir}`);
    return true;
  } catch (error) {
    // Display generator error output
    // Requirement: 13.5
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ JavaScript SDK generation failed');
    console.error('Error output:', errorMessage);

    // Suggest fixes for common errors
    // Requirement: 13.5
    const suggestion = suggestFixForError(errorMessage);
    console.error('\nSuggestion:', suggestion);

    return false;
  }
}

/**
 * Main SDK generation function
 */
async function main() {
  const args = process.argv.slice(2);
  const langArg =
    args.find((arg) => arg.startsWith('--lang=')) ||
    args.find((arg) => arg === '--lang' && args[args.indexOf(arg) + 1]);

  let language = 'typescript';
  if (typeof langArg === 'string' && langArg.startsWith('--lang=')) {
    language = langArg.split('=')[1];
  } else if (langArg === '--lang' && args[args.indexOf(langArg) + 1]) {
    language = args[args.indexOf(langArg) + 1];
  }

  // Validate language argument
  if (!['typescript', 'javascript'].includes(language)) {
    console.error(`Invalid language: ${language}. Supported languages: typescript, javascript`);
    process.exit(1);
  }

  // Determine spec path - use local file or fetch from running server
  let specPath = path.join(projectRoot, 'openapi.json');

  // If spec file doesn't exist, try to fetch from running server
  if (!fs.existsSync(specPath)) {
    console.log('Local OpenAPI spec not found. Attempting to fetch from running server...');
    try {
      const response = await fetch('http://localhost:3000/api-docs/openapi.json');
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const spec = await response.json();
      fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
      console.log('✓ OpenAPI spec fetched from server');
    } catch (error) {
      console.error(
        'Failed to fetch OpenAPI spec from server. Ensure server is running on http://localhost:3000',
      );
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  // Validate spec
  const isValid = await validateSpec(specPath);
  if (!isValid) {
    process.exit(1);
  }

  // Generate SDK based on language
  let success = false;
  if (language === 'typescript') {
    const outputDir = path.join(projectRoot, 'sdk', 'typescript');
    success = await generateTypeScriptSDK(specPath, outputDir);
  } else if (language === 'javascript') {
    const outputDir = path.join(projectRoot, 'sdk', 'javascript');
    success = await generateJavaScriptSDK(specPath, outputDir);
  }

  // Exit with non-zero status code on failure
  // Requirement: 13.5
  if (!success) {
    process.exit(1);
  }

  console.log('\n✓ SDK generation completed successfully');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
