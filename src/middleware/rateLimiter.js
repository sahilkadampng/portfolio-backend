import rateLimit from 'express-rate-limit';
import BlockedIP from '../models/BlockedIP.js';

// ──────────────────────────────────────────────
// Helper: Get the real client IP (supports proxies)
// ──────────────────────────────────────────────
export const getClientIP = (req) => {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown'
    );
};

// ──────────────────────────────────────────────
// Middleware: Check if the requesting IP is blocked
// Runs before any rate limiter to immediately deny blocked IPs
// ──────────────────────────────────────────────
export const checkBlocked = async (req, res, next) => {
    const ip = getClientIP(req);

    try {
        const blocked = await BlockedIP.findOne({ ip, active: true });
        if (blocked) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Your IP has been blocked due to excessive requests.',
                blockedAt: blocked.createdAt,
            });
        }
    } catch (err) {
        console.error('Block check error:', err.message);
    }

    next();
};

// ──────────────────────────────────────────────
// PUBLIC LIMITER
// For public endpoints: homepage, visitor tracking, email submission
// Allows 100 requests per 1-minute window per IP
// ──────────────────────────────────────────────
export const publicLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1-minute window
    max: 100,                   // max 100 requests per window per IP
    standardHeaders: true,      // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,       // Disable `X-RateLimit-*` headers
    keyGenerator: (req) => getClientIP(req),  // Use real client IP behind proxies
    message: {
        status: 'error',
        message: 'Too many requests, please try again later.',
    },
    handler: (req, res, next, options) => {
        console.log(`⚠️  Public rate limit hit by IP: ${getClientIP(req)}`);
        res.status(429).json(options.message);
    },
});

// ──────────────────────────────────────────────
// AUTH LIMITER
// For sensitive endpoints: login, OTP, password reset
// Strict limit of 10 requests per 1-minute window per IP
// Prevents brute-force attacks on authentication
// ──────────────────────────────────────────────
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1-minute window
    max: 10,                    // max 10 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIP(req),
    message: {
        status: 'error',
        message: 'Too many requests, please try again later.',
    },
    handler: async (req, res, next, options) => {
        const ip = getClientIP(req);
        console.log(`⛔ Auth rate limit hit by IP: ${ip}`);

        // Auto-block IPs that repeatedly hit the auth limiter
        try {
            const existing = await BlockedIP.findOne({ ip });
            if (!existing) {
                await BlockedIP.create({
                    ip,
                    reason: 'Auth rate limit exceeded: too many login attempts',
                    requestCount: options.max,
                });
                console.log(`⛔ Auto-blocked IP (auth abuse): ${ip}`);
            }
        } catch (err) {
            console.error('Auth auto-block error:', err.message);
        }

        res.status(429).json(options.message);
    },
});

// ──────────────────────────────────────────────
// ADMIN LIMITER
// For admin/protected endpoints: dashboard actions, CRUD operations
// Allows 20 requests per 1-minute window per IP
// Prevents abuse of privileged routes even with valid tokens
// ──────────────────────────────────────────────
export const adminLimiter = rateLimit({
    windowMs: 60 * 1000,       // 1-minute window
    max: 20,                    // max 20 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIP(req),
    message: {
        status: 'error',
        message: 'Too many requests, please try again later.',
    },
    handler: (req, res, next, options) => {
        console.log(`⚠️  Admin rate limit hit by IP: ${getClientIP(req)}`);
        res.status(429).json(options.message);
    },
});
