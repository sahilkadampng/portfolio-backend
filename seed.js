import Admin from './src/models/Admin.js';

const seedAdmin = async () => {
    try {
        const existingAdmin = await Admin.findOne({ email: process.env.ADMIN_EMAIL });

        if (!existingAdmin) {
            await Admin.create({
                email: process.env.ADMIN_EMAIL,
                password: process.env.ADMIN_PASSWORD,
                role: 'superadmin',
            });
            console.log(`Admin seeded: ${process.env.ADMIN_EMAIL}`);
        } else {
            console.log('Admin already exists. Skipping seed.');
        }
    } catch (error) {
        console.error('Error seeding admin:', error.message);
    }
};

export default seedAdmin;
