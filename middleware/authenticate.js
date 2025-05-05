const jwt = require('jsonwebtoken');
const secretKey = 'your_secret_key'; // Use a secure key, don't hard-code in production

const authenticate = (req, res, next) => {
  // console.log('Authorization Header:', req.header('Authorization'));
  const token = req.header('Authorization')?.replace('Bearer ', '');
  console.log(token); // Extract token from Authorization header

  if (!token) {
    return res.status(401).json({ message: 'Access denied, no token provided.' });
  }

  try {
    // Verify the token using the secret key
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded; // Attach the decoded token to the request
    console.log('before the auth completion');
    console.log(req.user);
    next(); 
    console.log('after the auth completion');// Call the next middleware or route handler
  } catch (error) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
};

module.exports = authenticate;
