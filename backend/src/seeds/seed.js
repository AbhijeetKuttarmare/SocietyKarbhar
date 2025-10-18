require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User, Society, Flat } = require('../models');

async function seed(){
  try{
    await sequelize.sync({ force: true });
    const pw = await bcrypt.hash('admin123', 10);
    const superadmin = await User.create({ name: 'Super Admin', phone: '9999999999', role: 'superadmin', password_hash: pw });
    const society = await Society.create({ name: 'Nagpur City', country: 'India', city: 'Nagpur', area: 'Sample Area', created_by: superadmin.id });
  const adminPw = await bcrypt.hash('admin123', 10);
  const admin = await User.create({ name: 'Nagpur Admin', phone: '9888888888', role: 'admin', password_hash: adminPw, societyId: society.id });
  // create admin->society link
  try{ await require('../models').AdminSociety.create({ userId: admin.id, societyId: society.id }); }catch(e){ console.warn('admin society link failed', e.message); }

  const ownerPw = await bcrypt.hash('owner123', 10);
  const owner = await User.create({ name: 'Owner One', phone: '9777777777', role: 'owner', password_hash: ownerPw, societyId: society.id });

  const tenantPw = await bcrypt.hash('tenant123', 10);
  const tenant = await User.create({ name: 'Tenant One', phone: '9666666666', role: 'tenant', password_hash: tenantPw, societyId: society.id });
    const flat = await Flat.create({ societyId: society.id, flat_no: 'A-101', ownerId: owner.id });
    console.log('Seed complete');
    process.exit(0);
  }catch(err){
    console.error(err);
    process.exit(1);
  }
}

seed();
