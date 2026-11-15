const jwt = require('jsonwebtoken');

function createAuthenticationMiddleware(jwtSecret) {
  return function autenticarToken(req, res, next) {
    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ mensagem: 'Acesso negado. Token não fornecido.' });
    }

    try {
      req.user = jwt.verify(token, jwtSecret);
      return next();
    } catch (error) {
      return res.status(403).json({ mensagem: 'Token inválido ou expirado.' });
    }
  };
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ mensagem: 'Acesso não autorizado para o seu perfil.' });
    }

    return next();
  };
}

module.exports = { createAuthenticationMiddleware, authorizeRoles };
