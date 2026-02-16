import express from 'express';
import Email from '../models/Email.js';
import protect from '../middleware/auth.js';

const router = express.Router();

// POST /api/emails — public: submit email from CTA
router.post('/', async (req, res) => {
    try {
        const { email, source } = req.body;

        if (!email) {
            return res.status(400).json({
                status: 'error',
                message: 'Email is required.',
            });
        }

        // Check if email already exists
        const existing = await Email.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.json({
                status: 'success',
                message: 'Email already registered.',
            });
        }

        const newEmail = await Email.create({
            email,
            source: source || 'cta',
            ip: req.ip,
        });

        res.status(201).json({
            status: 'success',
            message: 'Email received successfully.',
            data: { id: newEmail._id, email: newEmail.email },
        });
    } catch (error) {
        console.error('Email submission error:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                status: 'error',
                message: Object.values(error.errors).map((e) => e.message).join(', '),
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Server error. Try again later.',
        });
    }
});

// GET /api/emails — protected: list all emails (admin)
router.get('/', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search, sort = '-createdAt' } = req.query;

        const query = {};
        if (status && status !== 'all') query.status = status;
        if (search) {
            query.email = { $regex: search, $options: 'i' };
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [emails, total] = await Promise.all([
            Email.find(query).sort(sort).skip(skip).limit(Number(limit)),
            Email.countDocuments(query),
        ]);

        // Stats
        const [totalEmails, newEmails, contactedEmails] = await Promise.all([
            Email.countDocuments(),
            Email.countDocuments({ status: 'new' }),
            Email.countDocuments({ status: 'contacted' }),
        ]);

        res.json({
            status: 'success',
            data: emails,
            meta: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
            stats: {
                total: totalEmails,
                new: newEmails,
                contacted: contactedEmails,
                archived: totalEmails - newEmails - contactedEmails,
            },
        });
    } catch (error) {
        console.error('Fetch emails error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error.',
        });
    }
});

// PATCH /api/emails/:id — protected: update email status
router.patch('/:id', protect, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['new', 'contacted', 'archived'].includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status. Use: new, contacted, archived.',
            });
        }

        const email = await Email.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!email) {
            return res.status(404).json({
                status: 'error',
                message: 'Email not found.',
            });
        }

        res.json({
            status: 'success',
            data: email,
        });
    } catch (error) {
        console.error('Update email error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error.',
        });
    }
});

// DELETE /api/emails/:id — protected: delete email
router.delete('/:id', protect, async (req, res) => {
    try {
        const email = await Email.findByIdAndDelete(req.params.id);

        if (!email) {
            return res.status(404).json({
                status: 'error',
                message: 'Email not found.',
            });
        }

        res.json({
            status: 'success',
            message: 'Email deleted.',
        });
    } catch (error) {
        console.error('Delete email error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error.',
        });
    }
});

export default router;
