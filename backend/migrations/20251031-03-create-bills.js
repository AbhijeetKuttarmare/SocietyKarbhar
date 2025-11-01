'use strict';

/**
 * Create bills table to store owner-created bills separately from complaints
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('bills', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      cost: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'other' },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'open' },
      society_id: { type: Sequelize.UUID, allowNull: true },
      raised_by: { type: Sequelize.UUID, allowNull: true },
      assigned_to: { type: Sequelize.UUID, allowNull: true },
      payment_proof_url: { type: Sequelize.STRING, allowNull: true },
      payment_by: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('bills');
  },
};
