const path = require('path');

async function main() {
  try {
    const modelsPath = path.resolve(__dirname, '..', 'src', 'models');
    const models = require(modelsPath);
    await models.sequelize.authenticate();

    const phoneArg = process.argv[2] || '';
    const idArg = process.argv[3] || '';

    const User = models.User;
    const Agreement = models.Agreement;
    const Flat = models.Flat;

    let user = null;
    if (idArg) {
      user = await User.findByPk(idArg);
    }
    if (!user && phoneArg) {
      // normalize phone (strip non-digits)
      const phoneClean = String(phoneArg).replace(/\D/g, '');
      user = await User.findOne({ where: { phone: phoneClean } });
    }

    if (!user) {
      console.log(JSON.stringify({ error: 'user_not_found', phone: phoneArg, id: idArg }, null, 2));
      process.exit(0);
    }

    const userPlain = user.get ? user.get({ plain: true }) : user;

    const ags = await Agreement.findAll({ where: { tenantId: userPlain.id }, order: [['createdAt', 'DESC']] });
    const detailed = [];
    for (const a of ags) {
      const aPlain = a.get ? a.get({ plain: true }) : a;
      const flat = aPlain.flatId ? await Flat.findByPk(aPlain.flatId) : null;
      const flatPlain = flat && flat.get ? flat.get({ plain: true }) : flat;
      let owner = null;
      if (aPlain.ownerId) owner = await User.findByPk(aPlain.ownerId);
      else if (flatPlain && flatPlain.ownerId) owner = await User.findByPk(flatPlain.ownerId);
      const ownerPlain = owner && owner.get ? owner.get({ plain: true }) : owner;
      detailed.push({ agreement: aPlain, flat: flatPlain || null, owner: ownerPlain || null });
    }

    console.log(JSON.stringify({ tenant: userPlain, agreements: detailed }, null, 2));
    process.exit(0);
  } catch (e) {
    try {
      console.error('query failed', { message: e && e.message, stack: e && e.stack });
    } catch (err) {
      console.error('query failed (unknown error)');
    }
    process.exit(2);
  }
}

main();
