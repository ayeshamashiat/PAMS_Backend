const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, access denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const authorizeSelf = (req, res, next) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ message: 'Access denied: Not your resource' });
  }
  next();
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }
  next();
};

const User = require('../models/user');

const requireAuth = () => async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(401).json({ message: 'Unauthorized: Invalid token' });

    req.user = user; 
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Token error' });
  }
};

//wrapper fr allowed roles
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient role access' });
    }
    next();
  };
};

module.exports = {
  
};


module.exports = {
  protect,
  authorizeSelf,
  adminOnly,
  requireAuth,
  requireRole
};
