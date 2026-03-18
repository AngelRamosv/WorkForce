const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Campana = sequelize.define('Campana', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    totalAgentes: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    metaCapacidad: {
        type: DataTypes.INTEGER,
        defaultValue: 3195
    },
    turnosPermitidos: {
        type: DataTypes.JSON,
        defaultValue: ['A', 'B', 'C']
    },
    agentesNocturnos: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'campanas',
    timestamps: true
});

module.exports = Campana;
