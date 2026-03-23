const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Agente = sequelize.define('Agente', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    numero_agente: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    horaEntradaProgramada: {
        type: DataTypes.STRING, // "HH:mm"
        allowNull: true
    },
    turno: {
        type: DataTypes.STRING, // "Matutino", "Vespertino", "Nocturno"
        allowNull: true
    }
}, {
    tableName: 'agentes',
    timestamps: true
});

module.exports = Agente;
