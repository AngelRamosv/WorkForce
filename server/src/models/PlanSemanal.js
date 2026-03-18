const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const PlanSemanal = sequelize.define('PlanSemanal', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    campanaId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    numeroSemana: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    anio: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    distribucion: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
            "Lunes": 0, "Martes": 0, "Miercoles": 0, "Jueves": 0, "Viernes": 0, "Sabado": 0, "Domingo": 0
        }
    },
    estatus: {
        type: DataTypes.ENUM('Borrador', 'Publicado'),
        defaultValue: 'Borrador'
    }
}, {
    tableName: 'plan_semanales',
    timestamps: true
});

module.exports = PlanSemanal;
