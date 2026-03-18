const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const MetricaOperativa = sequelize.define('MetricaOperativa', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    campanaId: { type: DataTypes.UUID, allowNull: false },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    totalLlamadas: { type: DataTypes.INTEGER, defaultValue: 0 },
    llamadasContestadas: { type: DataTypes.INTEGER, defaultValue: 0 },
    llamadasAbandonadas: { type: DataTypes.INTEGER, defaultValue: 0 },
    nivelServicio: { type: DataTypes.FLOAT, defaultValue: 0 },
    totalAgentesActivos: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
    tableName: 'metricas_operativas',
    timestamps: true
});

module.exports = MetricaOperativa;
