const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Vacacion = sequelize.define('Vacacion', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombreAgente: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fechaInicio: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    fechaFin: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    campanaId: {
        type: DataTypes.UUID,
        allowNull: false
    }
}, {
    tableName: 'vacaciones',
    timestamps: true
});

module.exports = Vacacion;
