const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const WeeklyPlan = sequelize.define('WeeklyPlan', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    poolId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    weekNumber: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    // Almacenamos la distribución como JSON para el MVP
    distribution: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            "Monday": 0, "Tuesday": 0, "Wednesday": 0, "Thursday": 0, "Friday": 0, "Saturday": 0, "Sunday": 0
        }
    },
    status: {
        type: DataTypes.ENUM('Draft', 'Published'),
        defaultValue: 'Draft'
    }
});

module.exports = WeeklyPlan;
