import express from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email and password are required.',
            });
        }

        // Find admin with password field
        const admin = await Admin.findOne({ email }).select('+password');

        if (!admin) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials. Access denied.',
            });
        }

        const isMatch = await admin.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid credentials. Access denied.',
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: admin._id, email: admin.email, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            status: 'success',
            token,
            admin: {
                id: admin._id,
                email: admin.email,
                role: admin.role,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Server error. Try again later.',
        });
    }
});

// GET /api/auth/verify — verify token is valid
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ status: 'error', message: 'No token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id);

        if (!admin) {
            return res.status(401).json({ status: 'error', message: 'Admin not found' });
        }

        res.json({
            status: 'success',
            admin: { id: admin._id, email: admin.email, role: admin.role },
        });
    } catch {
        res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
});

export default router;
