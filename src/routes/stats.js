import express from 'express';
import Visitor from '../models/Visitor.js';
import Email from '../models/Email.js';
import BlockedIP from '../models/BlockedIP.js';
import protect from '../middleware/auth.js';

const router = express.Router();


router.get('/overview', protect, async (req, res) => {
    try {
        const [
            emailTotal,
            emailNew,
            visitorTotal,
            visitorUnique,
            blockedActive
        ] = await Promise.all([
            Email.countDocuments(),
            Email.countDocuments({ status: 'new' }),
            Visitor.countDocuments(),
            Visitor.distinct('ip').then(ips => ips.length),
            BlockedIP.countDocuments({ active: true })
        ]);

        res.json({
            status: 'success',
            data: {
                emails: { total: emailTotal, new: emailNew },
                visitors: { total: visitorTotal, unique: visitorUnique },
                blocked: { active: blockedActive }
            }
        });
    } catch (err) {
        console.error('Stats overview error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


router.get('/trends', protect, async (req, res) => {
    try {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 14);
        fifteenDaysAgo.setHours(0, 0, 0, 0);

        const [visitorTrends, emailTrends] = await Promise.all([
            Visitor.aggregate([
                { $match: { createdAt: { $gte: fifteenDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id": 1 } }
            ]),
            Email.aggregate([
                { $match: { createdAt: { $gte: fifteenDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id": 1 } }
            ])
        ]);

        
        const fillDates = (data) => {
            const map = new Map(data.map(item => [item._id, item.count]));
            const result = [];
            for (let i = 0; i < 15; i++) {
                const d = new Date(fifteenDaysAgo);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                result.push(map.get(dateStr) || 0);
            }
            return result;
        };

        res.json({
            status: 'success',
            data: {
                visitors: fillDates(visitorTrends),
                emails: fillDates(emailTrends)
            }
        });
    } catch (err) {
        console.error('Stats trends error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});


router.get('/activity', protect, async (req, res) => {
    try {
        const [recentVisitors, recentEmails] = await Promise.all([
            Visitor.find().sort('-createdAt').limit(10).lean(),
            Email.find().sort('-createdAt').limit(10).lean()
        ]);

        const combined = [
            ...recentVisitors.map(v => ({ type: 'visitor', data: `${v.ip} from ${v.country}`, time: v.createdAt })),
            ...recentEmails.map(e => ({ type: 'email', data: `New lead: ${e.email}`, time: e.createdAt }))
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

        res.json({
            status: 'success',
            data: combined
        });
    } catch (err) {
        console.error('Stats activity error:', err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

export default router;
