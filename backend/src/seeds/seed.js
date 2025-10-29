require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User, Society, Flat, Agreement } = require('../models');

async function seed() {
  try {
    await sequelize.sync({ force: true });
    const pw = await bcrypt.hash('admin123', 10);
    const superadmin = await User.create({
      name: 'Super Admin',
      phone: '9999999999',
      role: 'superadmin',
      password_hash: pw,
    });
    const society = await Society.create({
      name: 'Nagpur City',
      country: 'India',
      city: 'Nagpur',
      area: 'Sample Area',
      created_by: superadmin.id,
    });
    const adminPw = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      name: 'Nagpur Admin',
      phone: '9888888888',
      role: 'admin',
      password_hash: adminPw,
      societyId: society.id,
    });
    // create admin->society link
    try {
      await require('../models').AdminSociety.create({ userId: admin.id, societyId: society.id });
    } catch (e) {
      console.warn('admin society link failed', e.message);
    }

    // create owner with specific id/phone (requested)
    const ownerPw = await bcrypt.hash('owner123', 10);
    const owner = await User.create({
      id: '5c1f0a77-81a1-41d3-a3aa-fc580ce7a00a',
      name: 'Owner One',
      phone: '7080352088',
      role: 'owner',
      password_hash: ownerPw,
      societyId: society.id,
    });

    // create tenant with specific id/phone (requested)
    const tenantPw = await bcrypt.hash('tenant123', 10);
    const tenant = await User.create({
      id: '65851d70-2cde-4197-b852-fe0cfb99de61',
      name: 'Tenant One',
      phone: '9848484848',
      role: 'tenant',
      password_hash: tenantPw,
      societyId: society.id,
    });

    // create a flat owned by owner
    const flat = await Flat.create({ societyId: society.id, flat_no: 'A-101', ownerId: owner.id });

    // create an agreement linking tenant -> flat -> owner so tenant API returns owner
    try {
      await Agreement.create({ flatId: flat.id, ownerId: owner.id, tenantId: tenant.id });
    } catch (e) {
      console.warn('seed: failed to create agreement', e && e.message);
    }
    console.log('Seed complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
