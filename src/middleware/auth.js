import jwt from 'jsonwebtoken';

const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'Not authorized. No token provided.',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.adminId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({
            status: 'error',
            message: 'Not authorized. Invalid token.',
        });
    }
};

export default protect;
