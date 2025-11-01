module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  const Bill = sequelize.define(
    'Bill',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      title: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      cost: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'other',
        validate: {
          // include maintenance as a valid bill type
          isIn: [['rent', 'electricity', 'other', 'maintenance']],
        },
      },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'open' },
      // validate allowed bill types to avoid invalid values
      // allowed: rent, electricity, other
      // Note: Sequelize `validate` with isIn ensures only allowed values are saved at model level
      // This complements controller-level checks.
      // (Keep `type` just a string so migration remains simple.)
      // No DB enum used to simplify migrations across environments.
      societyId: { type: DataTypes.UUID, allowNull: true },
      raised_by: { type: DataTypes.UUID, allowNull: true },
      assigned_to: { type: DataTypes.UUID, allowNull: true },
      payment_proof_url: { type: DataTypes.STRING, allowNull: true },
      payment_by: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: 'bills',
      underscored: true,
    }
  );

  return Bill;
};
