import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import connectDB from './src/config/db.js';
import seedAdmin from './seed.js';
import authRoutes from './src/routes/auth.js';
import emailRoutes from './src/routes/emails.js';
import visitorRoutes from './src/routes/visitors.js';
import donateRoutes from './src/routes/donate.js';
import { checkBlocked, publicLimiter, authLimiter, adminLimiter } from './src/middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (for real IP behind reverse proxy)
app.set('trust proxy', true);

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://rawx.vercel.app',
        process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
}));
app.use(express.json());

// Security: check blocked IPs on all routes
app.use(checkBlocked);

// Routes with endpoint-specific rate limiters
app.use('/api/auth', authLimiter, authRoutes);           // Auth: 10 req/min (login, sensitive)
app.use('/api/emails', publicLimiter, emailRoutes);      // Public submissions + admin CRUD
app.use('/api/visitors', publicLimiter, visitorRoutes);  // Visitor tracking + admin views
app.use('/api/donate', publicLimiter, donateRoutes);     // Donation / support system

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'success',
        message: 'RAW Infrastructure API :: Active',
        version: 'v2.4',
        timestamp: new Date().toISOString(),
    });
});

// Global error handler
app.use((err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
    console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);
    res.status(statusCode).json({
        status: 'error',
        message: statusCode === 500 ? 'Internal server error.' : err.message,
    });
});

// Connect DB, seed admin, start server
const start = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI is not set. Please configure environment variables.');
            process.exit(1);
        }

        await connectDB();
        await seedAdmin();

        app.listen(PORT, () => {
            console.log(`\n⚡ RAW API Server running on http://localhost:${PORT}`);
            console.log(`   Health: http://localhost:${PORT}/api/health`);
            console.log(`   Auth:   POST http://localhost:${PORT}/api/auth/login`);
            console.log(`   Emails: http://localhost:${PORT}/api/emails\n`);
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

start();
