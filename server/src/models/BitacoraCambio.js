const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const BitacoraCambio = sequelize.define('BitacoraCambio', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombreEntidad: {
        type: DataTypes.STRING,
        allowNull: false
    },
    idEntidad: {
        type: DataTypes.UUID,
        allowNull: false
    },
    accion: {
        type: DataTypes.STRING,
        allowNull: false // Creado, Actualizado, Eliminado
    },
    cambios: {
        type: DataTypes.JSON,
        allowNull: true
    },
    usuario: {
        type: DataTypes.STRING,
        defaultValue: 'Sistema'
    }
}, {
    tableName: 'bitacora_cambios',
    timestamps: true
});

module.exports = BitacoraCambio;
