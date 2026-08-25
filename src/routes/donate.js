import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
    createOrder,
    verifyPayment,
    getTotal,
    getRecent,
} from '../controllers/donationController.js';

const router = express.Router();


router.post('/create-order', asyncHandler(createOrder));


router.post('/verify', asyncHandler(verifyPayment));


router.get('/total', asyncHandler(getTotal));


router.get('/recent', asyncHandler(getRecent));

export default router;
