const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Agent = sequelize.define('Agent', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    poolId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    scheduledStartTime: {
        type: DataTypes.STRING, // "HH:mm"
        allowNull: true
    },
    shift: {
        type: DataTypes.STRING, // "Matutino", "Vespertino", "Nocturno"
        allowNull: true
    }
});

module.exports = Agent;
