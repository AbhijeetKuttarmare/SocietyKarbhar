/*
  Migration: change societies.image_url column from STRING to TEXT to support long URLs
*/
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('societies', 'image_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('societies', 'image_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
