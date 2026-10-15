// Express 4 does not catch errors from async functions by itself.
// This wrapper sends any error to the error middleware.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export default asyncHandler;
