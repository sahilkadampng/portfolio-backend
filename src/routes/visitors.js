import express from 'express';
import jwt from 'jsonwebtoken';
import Visitor from '../../models/Visitor.js';
import BlockedIP from '../../models/BlockedIP.js';
import protect from '../../middleware/auth.js';
import { getClientIP } from '../../middleware/rateLimiter.js';

const router = express.Router();

const VISITOR_TOKEN_EXPIRY = '30m'; // session lasts 30 minutes

// Normalize localhost IPs
const normalizeIP = (ip) => {
    if (!ip || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '127.0.0.1') {
        return 'localhost';
    }
    // Strip ::ffff: prefix from IPv4-mapped IPv6
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
};

// POST /api/visitors/track — public: track a visitor
router.post('/track', async (req, res) => {
    try {
        const { page, referrer, device, browser, os, visitorToken, clientIP } = req.body;

        // Check if visitor already has a valid (non-expired) token
        if (visitorToken) {
            try {
                jwt.verify(visitorToken, process.env.JWT_SECRET);
                // Token still valid — don't count as new visit
                return res.json({ status: 'success', newVisit: false, token: visitorToken });
            } catch {
                // Token expired or invalid — fall through to create new visit
            }
        }

        // Get IP: prefer client-sent public IP, fallback to server-detected
        let ip = normalizeIP(getClientIP(req));
        if (clientIP && clientIP !== 'unknown' && clientIP !== 'localhost') {
            ip = clientIP;
        }

        await Visitor.create({
            ip,
            page: page || '/',
            referrer: referrer || 'direct',
            device: device || 'Unknown',
            browser: browser || 'Unknown',
            os: os || 'Unknown',
        });

        // Generate a visitor session token
        const token = jwt.sign(
            { ip, tracked: true },
            process.env.JWT_SECRET,
            { expiresIn: VISITOR_TOKEN_EXPIRY }
        );

        res.status(201).json({ status: 'success', newVisit: true, token });
    } catch (err) {
        console.error('Visitor track error:', err.message);
        res.status(500).json({ status: 'error', message: 'Failed to track visitor' });
    }
});

// GET /api/visitors — protected: list visitors
router.get('/', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const query = {};
        if (search) {
            query.$or = [
                { ip: { $regex: search, $options: 'i' } },
                { device: { $regex: search, $options: 'i' } },
                { browser: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [visitors, total] = await Promise.all([
            Visitor.find(query).sort('-createdAt').skip(skip).limit(Number(limit)),
            Visitor.countDocuments(query),
        ]);

        // Stats
        const totalVisitors = await Visitor.countDocuments();
        const uniqueIPs = await Visitor.distinct('ip');
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayVisitors = await Visitor.countDocuments({ createdAt: { $gte: todayStart } });

        res.json({
            status: 'success',
            data: visitors,
            meta: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
            stats: {
                total: totalVisitors,
                unique: uniqueIPs.length,
                today: todayVisitors,
            },
        });
    } catch (err) {
        console.error('Fetch visitors error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// GET /api/visitors/blocked — protected: list blocked IPs
router.get('/blocked', protect, async (req, res) => {
    try {
        const blocked = await BlockedIP.find().sort('-createdAt');
        res.json({
            status: 'success',
            data: blocked,
            stats: {
                total: blocked.length,
                active: blocked.filter((b) => b.active).length,
            },
        });
    } catch (err) {
        console.error('Fetch blocked error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// PATCH /api/visitors/blocked/:id — protected: toggle block status
router.patch('/blocked/:id', protect, async (req, res) => {
    try {
        const entry = await BlockedIP.findById(req.params.id);
        if (!entry) {
            return res.status(404).json({ status: 'error', message: 'Not found' });
        }

        entry.active = !entry.active;
        await entry.save();

        res.json({
            status: 'success',
            data: entry,
            message: entry.active ? 'IP blocked' : 'IP unblocked',
        });
    } catch (err) {
        console.error('Toggle block error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// DELETE /api/visitors/blocked/:id — protected: remove block
router.delete('/blocked/:id', protect, async (req, res) => {
    try {
        await BlockedIP.findByIdAndDelete(req.params.id);
        res.json({ status: 'success', message: 'Block removed' });
    } catch (err) {
        console.error('Delete block error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

export default router;
