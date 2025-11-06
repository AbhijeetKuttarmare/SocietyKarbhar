/*
  Migration: change users.avatar column from STRING to TEXT to support long URLs
*/
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Some DBs (Postgres) allow altering column type directly.
    // Use changeColumn to set TEXT for avatar.
    await queryInterface.changeColumn('users', 'avatar', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to STRING(255)
    await queryInterface.changeColumn('users', 'avatar', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
