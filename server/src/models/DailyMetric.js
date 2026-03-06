const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const DailyMetric = sequelize.define('DailyMetric', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    poolId: { type: DataTypes.INTEGER, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    totalCalls: { type: DataTypes.INTEGER, defaultValue: 0 },
    answeredCalls: { type: DataTypes.INTEGER, defaultValue: 0 },
    abandonedCalls: { type: DataTypes.INTEGER, defaultValue: 0 },
    serviceLevel: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalAgentsActive: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = DailyMetric;
