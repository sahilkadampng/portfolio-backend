import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
    createOrder,
    verifyPayment,
    getTotal,
    getRecent,
} from '../controllers/donationController.js';

const router = express.Router();

// POST /api/donate/create-order — create Razorpay order
router.post('/create-order', asyncHandler(createOrder));

// POST /api/donate/verify — verify payment signature
router.post('/verify', asyncHandler(verifyPayment));

// GET /api/donate/total — total donations raised
router.get('/total', asyncHandler(getTotal));

// GET /api/donate/recent — last 5 supporters
router.get('/recent', asyncHandler(getRecent));

export default router;
