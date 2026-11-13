// Small shared helpers the table and routes use.

/** Error that carries an HTTP status (and optional extra JSON fields). */
export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Wrap an async handler so a rejection becomes a clean error answer. */
export const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
