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

    // result.errors can be string | ErrorObject[] depending on the validator version
    const rawErrors = result.errors;
    const errors: { message: string }[] = Array.isArray(rawErrors)
      ? rawErrors.map((e) => ({
          message:
            typeof e === 'object' && e !== null && 'message' in e
              ? String((e as { message: unknown }).message)
              : String(e),
        }))
      : [{ message: String(rawErrors ?? 'Validation failed') }];

    return { valid: false, errors };
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: error instanceof Error ? error.message : 'Unknown validation error' }],
    };
  }
}
