import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
            default: 'Anonymous',
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        message: {
            type: String,
            trim: true,
            maxlength: [500, 'Message cannot exceed 500 characters'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [10, 'Minimum donation is ₹10'],
        },
        currency: {
            type: String,
            default: 'INR',
            enum: ['INR'],
        },
        status: {
            type: String,
            enum: ['created', 'success', 'failed'],
            default: 'created',
        },
        razorpay_order_id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        razorpay_payment_id: {
            type: String,
            index: true,
        },
        razorpay_signature: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Index for analytics queries
donationSchema.index({ status: 1, createdAt: -1 });

const Donation = mongoose.model('Donation', donationSchema);
export default Donation;
