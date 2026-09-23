/** Error carrying the HTTP status and machine-readable code the API returns. */
export class CmsError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "CmsError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static unauthorized(message = "Missing or invalid API key.") {
    return new CmsError(401, "unauthorized", message);
  }
  static forbidden(message = "This API key does not have the required scope.") {
    return new CmsError(403, "forbidden", message);
  }
  static notFound(message = "Not found.") {
    return new CmsError(404, "not_found", message);
  }
  static badRequest(message: string, details?: unknown) {
    return new CmsError(400, "bad_request", message, details);
  }
  static conflict(message: string) {
    return new CmsError(409, "conflict", message);
  }
  static tooManyRequests(message = "Rate limit exceeded.") {
    return new CmsError(429, "rate_limited", message);
  }
}
