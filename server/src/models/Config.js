const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Config = sequelize.define('Config', {
    shrinkage: {
        type: DataTypes.FLOAT,
        defaultValue: 0.20
    },
    occupancy: {
        type: DataTypes.FLOAT,
        defaultValue: 0.90
    },
    ahtMinutes: {
        type: DataTypes.FLOAT,
        defaultValue: 11.5
    },
    shiftHours: {
        type: DataTypes.FLOAT,
        defaultValue: 8.0
    },
    restDaysPerWeek: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    maxDescansosDia: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    maxVacacionesDia: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    dailyGoal: {
        type: DataTypes.INTEGER,
        defaultValue: 3195
    }
});

module.exports = Config;
