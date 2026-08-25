import express from 'express';
import jwt from 'jsonwebtoken';
import Visitor from '../models/Visitor.js';
import BlockedIP from '../models/BlockedIP.js';
import protect from '../middleware/auth.js';
import { getClientIP } from '../middleware/rateLimiter.js';


async function getGeoLocation(ip) {
    try {
        if (!ip || ip === 'localhost' || ip === 'unknown') {
            return { country: 'Unknown', city: 'Unknown', region: 'Unknown' };
        }
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`);
        const data = await res.json();
        if (data.status === 'success') {
            return {
                country: data.country || 'Unknown',
                city: data.city || 'Unknown',
                region: data.regionName || 'Unknown',
            };
        }
        return { country: 'Unknown', city: 'Unknown', region: 'Unknown' };
    } catch {
        return { country: 'Unknown', city: 'Unknown', region: 'Unknown' };
    }
}

const router = express.Router();

const VISITOR_TOKEN_EXPIRY = '30m'; 


const normalizeIP = (ip) => {
    if (!ip || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === '127.0.0.1') {
        return 'localhost';
    }
    
    if (ip.startsWith('::ffff:')) return ip.slice(7);
    return ip;
};


router.post('/track', async (req, res) => {
    try {
        const { page, referrer, device, browser, os, visitorToken, clientIP } = req.body;

        
        if (visitorToken) {
            try {
                jwt.verify(visitorToken, process.env.JWT_SECRET);
                
                return res.json({ status: 'success', newVisit: false, token: visitorToken });
            } catch {
                // Token expired or invalid — fall through to create new visit
            }
        }

        
        let ip = normalizeIP(getClientIP(req));
        if (clientIP && clientIP !== 'unknown' && clientIP !== 'localhost') {
            ip = clientIP;
        }

        
        const geo = await getGeoLocation(ip);

        await Visitor.create({
            ip,
            page: page || '/',
            referrer: referrer || 'direct',
            device: device || 'Unknown',
            browser: browser || 'Unknown',
            os: os || 'Unknown',
            country: geo.country,
            city: geo.city,
            region: geo.region,
        });

        
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


router.get('/', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, startDate, endDate } = req.query;
        const query = {};
        if (search) {
            query.$or = [
                { ip: { $regex: search, $options: 'i' } },
                { device: { $regex: search, $options: 'i' } },
                { browser: { $regex: search, $options: 'i' } },
            ];
        }

        
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [visitors, total] = await Promise.all([
            Visitor.find(query).sort('-createdAt').skip(skip).limit(Number(limit)),
            Visitor.countDocuments(query),
        ]);

        
        const totalVisitors = await Visitor.countDocuments(query);
        const uniqueIPs = await Visitor.distinct('ip', query);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayVisitors = await Visitor.countDocuments({ ...query, createdAt: { $gte: todayStart } });

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


router.get('/export', protect, async (req, res) => {
    try {
        const { search, startDate, endDate } = req.query;
        const query = {};
        if (search) {
            query.$or = [
                { ip: { $regex: search, $options: 'i' } },
                { device: { $regex: search, $options: 'i' } },
                { browser: { $regex: search, $options: 'i' } },
            ];
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const visitors = await Visitor.find(query).sort('-createdAt');

        const headers = ['ID', 'IP', 'Country', 'City', 'Device', 'Browser', 'OS', 'Page', 'Date'];
        const rows = visitors.map(v => [
            v._id,
            v.ip,
            v.country,
            v.city,
            v.device,
            v.browser,
            v.os,
            v.page,
            v.createdAt.toISOString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell || 'N/A'}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=visitors-export-${new Date().toISOString().split('T')[0]}.csv`);
        res.status(200).send(csvContent);
    } catch (err) {
        console.error('Export visitors error:', err);
        res.status(500).json({ status: 'error', message: 'Export failed' });
    }
});


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


router.delete('/blocked/:id', protect, async (req, res) => {
    try {
        await BlockedIP.findByIdAndDelete(req.params.id);
        res.json({ status: 'success', message: 'Block removed' });
    } catch (err) {
        console.error('Delete block error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


router.post('/block-ip', protect, async (req, res) => {
    try {
        const { ip, reason } = req.body;
        if (!ip) return res.status(400).json({ status: 'error', message: 'IP is required' });

        const existing = await BlockedIP.findOne({ ip });
        if (existing) {
            existing.active = true;
            existing.reason = reason || 'Manually blocked';
            await existing.save();
            return res.json({ status: 'success', message: 'IP re-blocked', data: existing });
        }

        const blocked = await BlockedIP.create({ ip, reason: reason || 'Manually blocked', requestCount: 0 });
        res.status(201).json({ status: 'success', message: 'IP blocked', data: blocked });
    } catch (err) {
        console.error('Manual block error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


router.delete('/:id', protect, async (req, res) => {
    try {
        await Visitor.findByIdAndDelete(req.params.id);
        res.json({ status: 'success', message: 'Visitor record deleted' });
    } catch (err) {
        console.error('Delete visitor error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

export default router;
