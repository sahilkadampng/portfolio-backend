import FeatureFlag from '../models/FeatureFlag.js';
import { defaultFeatureFlags, featureFlagSelect } from '../config/featureFlags.js';

export async function seedFeatureFlags() {
    const operations = defaultFeatureFlags.map((flag) => ({
        updateOne: {
            filter: { key: flag.key },
            update: { $setOnInsert: flag },
            upsert: true,
        },
    }));

    await FeatureFlag.bulkWrite(operations, { ordered: false });
}

export async function getFeatureFlags() {
    await seedFeatureFlags();
    return FeatureFlag.find({}).sort({ category: 1, label: 1 }).select(featureFlagSelect).lean();
}

export async function getPublicFeatureFlags() {
    await seedFeatureFlags();
    const flags = await FeatureFlag.find({}).select({ key: 1, enabled: 1, route: 1 }).lean();

    return flags.reduce((accumulator, flag) => {
        accumulator[flag.key] = {
            enabled: flag.enabled,
            route: flag.route,
        };
        return accumulator;
    }, {});
}

export async function updateFeatureFlag(key, updates) {
    await seedFeatureFlags();

    const flag = await FeatureFlag.findOneAndUpdate(
        { key },
        { $set: updates },
        { new: true }
    ).select(featureFlagSelect).lean();

    return flag;
}