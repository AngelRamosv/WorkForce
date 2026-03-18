const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Configuracion = sequelize.define('Configuracion', {
    shrinkage: {
        type: DataTypes.FLOAT,
        defaultValue: 0.20
    },
    ocupacion: {
        type: DataTypes.FLOAT,
        defaultValue: 0.90
    },
    tmoMinutos: {
        type: DataTypes.FLOAT,
        defaultValue: 11.5
    },
    horasTurno: {
        type: DataTypes.FLOAT,
        defaultValue: 8.0
    },
    diasDescansoSemana: {
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
    metaDiaria: {
        type: DataTypes.INTEGER,
        defaultValue: 3195
    },
    ajusteLlamadas: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    ajusteAbandonadas: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    toleranciaRetardoMinutos: {
        type: DataTypes.INTEGER,
        defaultValue: 5
    }
}, {
    tableName: 'configuracion',
    timestamps: true
});

module.exports = Configuracion;
