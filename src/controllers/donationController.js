import * as donationService from '../services/donationService.js';
import { validateCreateOrder, validateVerifyPayment } from '../utils/validators.js';

// ──────────────────────────────────────────────
// POST /api/donate/create-order
// ──────────────────────────────────────────────
export const createOrder = async (req, res) => {
    const { amount, name, email, message } = req.body;

    const validation = validateCreateOrder({ amount });
    if (!validation.valid) {
        return res.status(400).json({ status: 'error', message: validation.message });
    }

    const order = await donationService.createOrder({ amount, name, email, message });

    res.status(201).json({
        status: 'success',
        data: order,
    });
};

// ──────────────────────────────────────────────
// POST /api/donate/verify
// ──────────────────────────────────────────────
export const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const validation = validateVerifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
    if (!validation.valid) {
        return res.status(400).json({ status: 'error', message: validation.message });
    }

    const donation = await donationService.verifyPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
    });

    res.json({
        status: 'success',
        message: 'Payment verified successfully.',
        data: {
            id: donation._id,
            amount: donation.amount,
            name: donation.name,
        },
    });
};

// ──────────────────────────────────────────────
// GET /api/donate/total
// ──────────────────────────────────────────────
export const getTotal = async (_req, res) => {
    const stats = await donationService.getTotalDonations();

    res.json({
        status: 'success',
        data: stats,
    });
};

// ──────────────────────────────────────────────
// GET /api/donate/recent
// ──────────────────────────────────────────────
export const getRecent = async (_req, res) => {
    const supporters = await donationService.getRecentSupporters(5);

    res.json({
        status: 'success',
        data: supporters,
    });
};
