import Admin from './src/models/Admin.js';

const seedAdmin = async () => {
    try {
        const adminSeeds = [
            {
                email: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PASSWORD,
                role: 'superadmin',
            },
            {
                email: process.env.ADMIN_EMAIL_2,
                password: process.env.ADMIN_PASSWORD_2,
                role: process.env.ADMIN_ROLE_2 || 'admin',
            },
        ].filter((admin) => admin.email && admin.password);

        for (const adminSeed of adminSeeds) {
            const existingAdmin = await Admin.findOne({ email: adminSeed.email });

            if (!existingAdmin) {
                await Admin.create(adminSeed);
                console.log(`Admin seeded: ${adminSeed.email}`);
            } else {
                console.log(`Admin already exists. Skipping seed: ${adminSeed.email}`);
            }
        }
    } catch (error) {
        console.error('Error seeding admin:', error.message);
    }
};

export default seedAdmin;
