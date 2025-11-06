'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { STRING } = Sequelize;
    const desc = await queryInterface.describeTable('societies');
    if (!desc.builder_name) {
      await queryInterface.addColumn('societies', 'builder_name', {
        type: STRING,
        allowNull: true,
      });
    }
    if (!desc.image_url) {
      await queryInterface.addColumn('societies', 'image_url', { type: STRING, allowNull: true });
    }
  },

  down: async (queryInterface) => {
    const desc = await queryInterface.describeTable('societies');
    if (desc.builder_name) await queryInterface.removeColumn('societies', 'builder_name');
    if (desc.image_url) await queryInterface.removeColumn('societies', 'image_url');
  },
};
