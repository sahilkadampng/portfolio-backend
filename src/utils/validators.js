/**
 * Validate donation create-order request body.
 * Returns { valid: true } or { valid: false, message: string }.
 */
export function validateCreateOrder({ amount }) {
    if (amount === undefined || amount === null) {
        return { valid: false, message: 'Amount is required.' };
    }

    const numAmount = Number(amount);

    if (isNaN(numAmount) || !isFinite(numAmount)) {
        return { valid: false, message: 'Amount must be a valid number.' };
    }

    if (numAmount < 10) {
        return { valid: false, message: 'Minimum donation amount is ₹10.' };
    }

    if (numAmount > 500000) {
        return { valid: false, message: 'Maximum donation amount is ₹5,00,000.' };
    }

    return { valid: true };
}

/**
 * Validate verify payment request body.
 */
export function validateVerifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return {
            valid: false,
            message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
        };
    }
    return { valid: true };
}
