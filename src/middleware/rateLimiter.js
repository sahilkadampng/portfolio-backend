import rateLimit from 'express-rate-limit';
import BlockedIP from '../models/BlockedIP.js';




export const getClientIP = (req) => {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        'unknown'
    );
};





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






export const publicLimiter = rateLimit({
    windowMs: 60 * 1000,       
    max: 100,                   
    standardHeaders: true,      
    legacyHeaders: false,       
    keyGenerator: (req) => getClientIP(req),  
    message: {
        status: 'error',
        message: 'Too many requests, please try again later.',
    },
    handler: (req, res, next, options) => {
        console.log(`⚠️  Public rate limit hit by IP: ${getClientIP(req)}`);
        res.status(429).json(options.message);
    },
});







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
