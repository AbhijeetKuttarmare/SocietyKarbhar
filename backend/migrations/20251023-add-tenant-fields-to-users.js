'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'address', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'gender', { type: Sequelize.ENUM('male','female','other'), allowNull: true });
    await queryInterface.addColumn('users', 'move_in', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('users', 'move_out', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('users', 'rent', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('users', 'deposit', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('users', 'status', { type: Sequelize.ENUM('active','inactive'), allowNull: false, defaultValue: 'active' });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'address');
    await queryInterface.removeColumn('users', 'gender');
    await queryInterface.removeColumn('users', 'move_in');
    await queryInterface.removeColumn('users', 'move_out');
    await queryInterface.removeColumn('users', 'rent');
    await queryInterface.removeColumn('users', 'deposit');
    await queryInterface.removeColumn('users', 'status');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_users_gender\";");
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_users_status\";");
  }
};