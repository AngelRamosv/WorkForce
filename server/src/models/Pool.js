const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Pool = sequelize.define('Pool', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    totalAgents: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    capacityGoal: {
        type: DataTypes.INTEGER,
        defaultValue: 3195
    },
    allowedShifts: {
        type: DataTypes.JSON,
        defaultValue: ['A', 'B', 'C']
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

module.exports = Pool;
