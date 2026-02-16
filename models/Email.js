import mongoose from 'mongoose';

const emailSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        source: {
            type: String,
            enum: ['cta', 'contact', 'newsletter'],
            default: 'cta',
        },
        status: {
            type: String,
            enum: ['new', 'contacted', 'archived'],
            default: 'new',
        },
        ip: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

emailSchema.index({ email: 1 });
emailSchema.index({ createdAt: -1 });
emailSchema.index({ status: 1 });

const Email = mongoose.model('Email(portfolio)', emailSchema);

export default Email;
