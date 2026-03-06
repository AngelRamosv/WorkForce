const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    entityName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    entityId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false // Created, Updated, Deleted
    },
    changes: {
        type: DataTypes.JSON,
        allowNull: true
    },
    user: {
        type: DataTypes.STRING,
        defaultValue: 'System'
    }
});

module.exports = AuditLog;
