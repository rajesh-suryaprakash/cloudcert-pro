import { Validator } from '@seriousme/openapi-schema-validator';

/**
 * Validate OpenAPI specification against OpenAPI 3.0 schema
 * Requirements: 7.1, 7.5
 */
export async function validateOpenAPISpec(
  spec: Record<string, unknown>,
): Promise<{ valid: boolean; errors?: { message: string }[] }> {
  try {
    const validator = new Validator();
    const result = await validator.validate(spec);

    if (result.valid) {
      return { valid: true };
    }

    return {
      valid: false,
      errors: result.errors,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: error instanceof Error ? error.message : 'Unknown validation error' }],
    };
  }
}
