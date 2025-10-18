const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function authenticate(req, res, next){
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({ error: 'no token' });
  const token = auth.split(' ')[1];
  try{
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev');
    // include adminSocieties so we can attach a societyId for admin users
    const user = await User.findByPk(payload.id, { include: [{ association: 'adminSocieties', through: { attributes: [] } }] });
    if(!user) return res.status(401).json({ error: 'invalid token' });
    // For admin users, attach a societyId to req.user for scoping
    if(user.role === 'admin'){
      // if the user is linked to societies via adminSocieties, pick the first one
      const first = (user.adminSocieties && user.adminSocieties[0]) || null;
      if(first) user.societyId = first.id || first.societyId || first;
    }
    req.user = user;
    next();
  }catch(err){
    return res.status(401).json({ error: 'invalid token' });
  }
}

function authorize(roles = []){
  return (req, res, next) => {
    if(!req.user) return res.status(401).json({ error: 'not authenticated' });
    if(roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  }
}

module.exports = { authenticate, authorize };
