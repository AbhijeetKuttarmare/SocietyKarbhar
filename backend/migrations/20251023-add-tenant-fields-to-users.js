'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (!table.address) {
      await queryInterface.addColumn('users', 'address', { type: Sequelize.STRING, allowNull: true });
    }
    if (!table.gender) {
      await queryInterface.addColumn('users', 'gender', { type: Sequelize.ENUM('male','female','other'), allowNull: true });
    }
    if (!table.move_in) {
      await queryInterface.addColumn('users', 'move_in', { type: Sequelize.DATE, allowNull: true });
    }
    if (!table.move_out) {
      await queryInterface.addColumn('users', 'move_out', { type: Sequelize.DATE, allowNull: true });
    }
    if (!table.rent) {
      await queryInterface.addColumn('users', 'rent', { type: Sequelize.INTEGER, allowNull: true });
    }
    if (!table.deposit) {
      await queryInterface.addColumn('users', 'deposit', { type: Sequelize.INTEGER, allowNull: true });
    }
    if (!table.status) {
      await queryInterface.addColumn('users', 'status', { type: Sequelize.ENUM('active','inactive'), allowNull: false, defaultValue: 'active' });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('users');
    if (table.address) await queryInterface.removeColumn('users', 'address');
    if (table.gender) await queryInterface.removeColumn('users', 'gender');
    if (table.move_in) await queryInterface.removeColumn('users', 'move_in');
    if (table.move_out) await queryInterface.removeColumn('users', 'move_out');
    if (table.rent) await queryInterface.removeColumn('users', 'rent');
    if (table.deposit) await queryInterface.removeColumn('users', 'deposit');
    if (table.status) await queryInterface.removeColumn('users', 'status');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_users_gender\";");
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_users_status\";");
  }
};