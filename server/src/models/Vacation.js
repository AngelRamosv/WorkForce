const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Vacation = sequelize.define('Vacation', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    agentName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    poolId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

module.exports = Vacation;
