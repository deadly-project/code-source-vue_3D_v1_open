import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'opencode_jwt_secret_fallback';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expire. Veuillez vous reconnecter.' });
    }
    return res.status(403).json({ error: 'Token invalide' });
  }
}
