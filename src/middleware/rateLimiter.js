import BlockedIP from '../models/BlockedIP.js';

// In-memory request counter: { ip: { count, windowStart } }
const requestCounts = new Map();

const WINDOW_MS = 1000;   // 1 second window
const MAX_REQUESTS = 15;  // 15 requests per second

// Get real client IP (supports proxies)
export const getClientIP = (req) => {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown'
    );
};

// Middleware: check if IP is blocked
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

// Middleware: rate limiter + auto-block at >15 req/s
export const rateLimiter = async (req, res, next) => {
    const ip = getClientIP(req);
    const now = Date.now();

    let entry = requestCounts.get(ip);

    if (!entry || now - entry.windowStart >= WINDOW_MS) {
        // New window
        requestCounts.set(ip, { count: 1, windowStart: now });
        return next();
    }

    entry.count++;

    if (entry.count > MAX_REQUESTS) {
        // Auto-block this IP
        try {
            const existing = await BlockedIP.findOne({ ip });
            if (!existing) {
                await BlockedIP.create({
                    ip,
                    reason: `Rate limit exceeded: ${entry.count} requests in 1 second`,
                    requestCount: entry.count,
                });
                console.log(`⛔ Auto-blocked IP: ${ip} (${entry.count} req/s)`);
            }
        } catch (err) {
            console.error('Auto-block error:', err.message);
        }

        return res.status(429).json({
            status: 'error',
            message: 'Too many requests. You have been blocked.',
        });
    }

    next();
};

// Cleanup old entries every 30 seconds
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of requestCounts) {
        if (now - entry.windowStart > 10000) {
            requestCounts.delete(ip);
        }
    }
}, 30000);
