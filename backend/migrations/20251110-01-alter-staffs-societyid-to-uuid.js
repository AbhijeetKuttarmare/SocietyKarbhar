'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { UUID } = Sequelize;

    // helper to ensure a table exists and alter/add societyId as UUID
    async function ensureForTable(tableName) {
      try {
        await queryInterface.describeTable(tableName);
      } catch (e) {
        return false;
      }

      // If societyId exists and is not UUID, drop and re-add as UUID
      const desc = await queryInterface.describeTable(tableName);
      if (desc.societyId) {
        // Drop the existing column then add a UUID column
        try {
          await queryInterface.removeColumn(tableName, 'societyId');
        } catch (e) {
          // ignore
        }
      }
      // Add new UUID column
      await queryInterface.addColumn(tableName, 'societyId', { type: UUID, allowNull: true });
      return true;
    }

    // Try both common variants
    if (await ensureForTable('Staffs')) return;
    if (await ensureForTable('staffs')) return;

    // If neither exists, try creating the canonical table 'Staffs'
    await queryInterface.createTable('Staffs', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      staffType: { type: Sequelize.STRING, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      wingId: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'active' },
      societyId: { type: UUID, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn('Staffs', 'societyId');
    } catch (e) {}
    try {
      await queryInterface.removeColumn('staffs', 'societyId');
    } catch (e) {}
  },
};
