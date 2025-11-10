'use strict';

// Safe helper script to ensure visitors table has a societyId UUID column and optionally backfill it.
// Run from backend folder: node scripts/add_visitors_societyId.js

(async () => {
  try {
    const models = require('../src/models');
    const sequelize = models.sequelize;
    const Sequelize = require('sequelize');
    const qi = sequelize.getQueryInterface();

    const candidates = ['visitors', 'Visitors'];
    let tableFound = null;
    let desc = null;
    for (const t of candidates) {
      try {
        desc = await qi.describeTable(t);
        tableFound = t;
        break;
      } catch (e) {
        // ignore
      }
    }

    if (!tableFound) {
      console.error('No visitors table found. Checked candidates:', candidates.join(', '));
      process.exit(1);
    }

    console.log('Found visitors table:', tableFound);

    if (desc && desc.societyId) {
      console.log('Column societyId already exists on', tableFound);
    } else {
      console.log('Adding societyId column to', tableFound);
      await qi.addColumn(tableFound, 'societyId', { type: Sequelize.UUID, allowNull: true });
      console.log('Added societyId column');
    }

    // Attempt best-effort backfill: use flatId -> flats.societyId, then wingId -> buildings.societyId
    try {
      console.log('Attempting backfill from flats (where visitors.flatId matches flats.id)');
      // Some table names may be capitalized; try both flats and Flats
      const flatTableCandidates = ['flats', 'Flats'];
      let flatTable = null;
      for (const ft of flatTableCandidates) {
        try {
          await qi.describeTable(ft);
          flatTable = ft;
          break;
        } catch (e) {}
      }
      if (flatTable) {
        const updateSql = `UPDATE "${tableFound}" v SET "societyId" = f."societyId" FROM "${flatTable}" f WHERE v."flatId" = f.id AND (v."societyId" IS NULL)`;
        const [res] = await sequelize.query(updateSql);
        console.log('Backfill from flats executed');
      } else {
        console.log('No flats table found for backfill');
      }
    } catch (e) {
      console.warn('Backfill from flats failed', e && e.message);
    }

    try {
      console.log(
        'Attempting backfill from buildings (where visitors.wingId matches buildings.id)'
      );
      const buildingTableCandidates = ['buildings', 'Buildings'];
      let buildingTable = null;
      for (const bt of buildingTableCandidates) {
        try {
          await qi.describeTable(bt);
          buildingTable = bt;
          break;
        } catch (e) {}
      }
      if (buildingTable) {
        const updateSql = `UPDATE "${tableFound}" v SET "societyId" = b."societyId" FROM "${buildingTable}" b WHERE v."wingId" = b.id AND (v."societyId" IS NULL)`;
        await sequelize.query(updateSql);
        console.log('Backfill from buildings executed');
      } else {
        console.log('No buildings table found for backfill');
      }
    } catch (e) {
      console.warn('Backfill from buildings failed', e && e.message);
    }

    console.log('Done. Please restart your server and re-test visitor creation.');
    process.exit(0);
  } catch (err) {
    console.error('Script failed:', err && (err.stack || err.message || err));
    process.exit(2);
  }
})();
