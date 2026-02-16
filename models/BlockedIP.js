import mongoose from 'mongoose';

const blockedIPSchema = new mongoose.Schema(
    {
        ip: {
            type: String,
            required: true,
            unique: true,
        },
        reason: {
            type: String,
            default: 'Rate limit exceeded (15 req/s)',
        },
        requestCount: {
            type: Number,
            default: 0,
        },
        active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

blockedIPSchema.index({ ip: 1 });
blockedIPSchema.index({ active: 1 });

const BlockedIP = mongoose.model('BlockedIP(portfolio)', blockedIPSchema);

export default BlockedIP;
