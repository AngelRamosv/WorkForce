const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Asistencia = sequelize.define('Asistencia', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombreAgente: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    horaEntradaProgramada: {
        type: DataTypes.STRING, // formato "HH:mm"
        allowNull: true
    },
    horaEntradaReal: {
        type: DataTypes.STRING, // formato "HH:mm"
        allowNull: true
    },
    tiempoLogueado: {
        type: DataTypes.STRING, // formato "HH:mm:ss"
        allowNull: true
    },
    minutosRetardo: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    impactoLlamadas: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    estatusAsistencia: {
        type: DataTypes.ENUM('A Tiempo', 'Retardo', 'Falta'),
        defaultValue: 'A Tiempo'
    },
    campanaId: {
        type: DataTypes.UUID,
        allowNull: true
    }
}, {
    tableName: 'asistencias',
    timestamps: true
});

module.exports = Asistencia;
