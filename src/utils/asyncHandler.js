/**
 * Async wrapper to eliminate try-catch boilerplate in route handlers.
 * Wraps an async function and forwards any thrown errors to Express error handler.
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
