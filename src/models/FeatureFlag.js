import mongoose from 'mongoose';

const featureFlagSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        label: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            enum: ['page', 'content', 'navigation'],
            required: true,
            default: 'content',
        },
        route: {
            type: String,
            trim: true,
            default: '',
        },
        target: {
            type: String,
            trim: true,
            default: '',
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        enabled: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

const FeatureFlag = mongoose.model('FeatureFlag(portfolio)', featureFlagSchema);

export default FeatureFlag;