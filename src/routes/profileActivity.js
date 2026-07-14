import express from 'express';
import { getProfileActivity } from '../services/profileActivityService.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const githubUsername = String(req.query.github || process.env.GITHUB_USERNAME || 'sahilkadampng').trim();
        const leetcodeUsername = String(req.query.leetcode || process.env.LEETCODE_USERNAME || '').trim();

        const data = await getProfileActivity({ githubUsername, leetcodeUsername });

        res.json({
            status: 'success',
            data,
        });
    } catch (error) {
        console.error('Profile activity error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Unable to load profile activity.',
        });
    }
});

export default router;