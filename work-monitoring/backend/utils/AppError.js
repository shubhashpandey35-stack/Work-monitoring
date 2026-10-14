// An error that carries an HTTP status code (400, 401, 403, 404, ...)
export default class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}
