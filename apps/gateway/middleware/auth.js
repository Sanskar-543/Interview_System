import jwt from 'jsonwebtoken';
import { env } from '@ai-interviewer/shared';
import { AppError } from '../errors/AppError.js';
export const authenticateToken = (req, _res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return next(new AppError('UNAUTHORIZED', 'Missing token', 401));
    }
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch {
        return next(new AppError('FORBIDDEN', 'Invalid or expired token', 403));
    }
};
