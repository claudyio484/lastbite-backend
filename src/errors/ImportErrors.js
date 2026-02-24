'use strict';

/**
 * Thrown when a file cannot be parsed (corrupt, empty, unsupported format).
 * Maps to HTTP 422.
 */
class ImportParseError extends Error {
  /**
   * @param {string} message  Human-readable description of the parse failure
   * @param {object} [details]  Optional structured details (e.g. { mimetype, size })
   */
  constructor(message, details) {
    super(message);
    this.name = 'ImportParseError';
    this.status = 422;
    this.code = 'PARSE_FAILED';
    this.details = details || null;
  }
}

/**
 * Thrown when row-level validation produces errors that block processing.
 * Maps to HTTP 422.
 */
class ImportValidationError extends Error {
  /**
   * @param {Array<{row: number, field: string, value: string, error: string}>} errors
   */
  constructor(errors) {
    super(`Validation failed with ${errors.length} error(s)`);
    this.name = 'ImportValidationError';
    this.status = 422;
    this.code = 'VALIDATION_FAILED';
    this.errors = errors;
  }
}

/**
 * Thrown when the transactional confirm step fails.
 * Maps to HTTP 500.
 */
class ImportConfirmError extends Error {
  /**
   * @param {string} message  Description of the failure
   * @param {string} [batchId]  The ImportBatch id if one was created before the failure
   */
  constructor(message, batchId) {
    super(message);
    this.name = 'ImportConfirmError';
    this.status = 500;
    this.code = 'CONFIRM_FAILED';
    this.batchId = batchId || null;
  }
}

module.exports = { ImportParseError, ImportValidationError, ImportConfirmError };
