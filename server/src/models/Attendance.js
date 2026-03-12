const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Attendance = sequelize.define('Attendance', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    agentName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    scheduledStartTime: {
        type: DataTypes.STRING, // format "HH:mm"
        allowNull: true
    },
    actualLoginTime: {
        type: DataTypes.STRING, // format "HH:mm"
        allowNull: true
    },
    delayMinutes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('OnTime', 'Late', 'Absent'),
        defaultValue: 'OnTime'
    },
    poolId: {
        type: DataTypes.UUID,
        allowNull: true
    }
});

module.exports = Attendance;
