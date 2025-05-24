const jwt = require('jsonwebtoken');
const secretKey = 'your_secret_key'; // Use a secure key, don't hard-code in production

const authenticate = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log(token);

    if (!token) {
        return res.status(401).json({ message: 'Access denied, no token provided.' });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        req.user = decoded;
        console.log('before the auth completion');
        console.log(req.user);
        next();
        console.log('after the auth completion');
    } catch (error) {
        return res.status(400).json({ message: 'Invalid or expired token' });
    }
};

module.exports = authenticate;