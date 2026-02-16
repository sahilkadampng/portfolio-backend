import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema(
    {
        ip: {
            type: String,
            required: true,
        },
        device: {
            type: String,
            default: 'Unknown',
        },
        browser: {
            type: String,
            default: 'Unknown',
        },
        os: {
            type: String,
            default: 'Unknown',
        },
        page: {
            type: String,
            default: '/',
        },
        referrer: {
            type: String,
            default: 'direct',
        },
        country: {
            type: String,
            default: 'Unknown',
        },
    },
    {
        timestamps: true,
    }
);

visitorSchema.index({ ip: 1 });
visitorSchema.index({ createdAt: -1 });

const Visitor = mongoose.model('Visitor(portfolio)', visitorSchema);

export default Visitor;
