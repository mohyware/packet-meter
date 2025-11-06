/**
 * Check if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Check if error has a specific message
 */
export function hasErrorMessage(error: unknown, message: string): boolean {
  return isError(error) && error.message === message;
}
