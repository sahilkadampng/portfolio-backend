import Razorpay from 'razorpay';
import crypto from 'crypto';
import Donation from '../models/Donation.js';




let razorpayInstance = null;

function getRazorpay() {
    if (!razorpayInstance) {
        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpayInstance;
}




export async function createOrder({ amount, name, email, message }) {
    const amountInPaise = Math.round(Number(amount) * 100);

    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `don_${Date.now()}`,
        notes: {
            name: name || 'Anonymous',
            email: email || '',
            message: message || '',
        },
    });

    
    await Donation.create({
        name: name || 'Anonymous',
        email: email || undefined,
        message: message || undefined,
        amount: Number(amount),
        currency: 'INR',
        status: 'created',
        razorpay_order_id: order.id,
    });

    return {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
    };
}




export async function verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

    const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(razorpay_signature, 'hex')
    );

    if (!isValid) {
        
        await Donation.findOneAndUpdate(
            { razorpay_order_id },
            { status: 'failed' }
        );
        throw Object.assign(new Error('Invalid payment signature.'), { statusCode: 400 });
    }

    
    const donation = await Donation.findOneAndUpdate(
        { razorpay_order_id },
        {
            status: 'success',
            razorpay_payment_id,
            razorpay_signature,
        },
        { new: true }
    );

    if (!donation) {
        throw Object.assign(new Error('Donation record not found.'), { statusCode: 404 });
    }

    return donation;
}




export async function getTotalDonations() {
    const result = await Donation.aggregate([
        { $match: { status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    return {
        total: result[0]?.total || 0,
        count: result[0]?.count || 0,
    };
}




export async function getRecentSupporters(limit = 5) {
    return Donation.find({ status: 'success' })
        .select('name amount createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
}
