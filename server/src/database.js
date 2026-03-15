const { Sequelize } = require('sequelize');
require('dotenv').config();

const dialect = process.env.DB_DIALECT || 'mysql';

let sequelize;

if (dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  });
  console.log('📦 Using SQLite (Local File Mode)');
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'workforce_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || 'root',
    {
      host: process.env.DB_HOST || 'localhost',
      dialect: 'mysql',
      logging: false,
      retry: {
        max: 3
      }
    }
  );
}

module.exports = sequelize;
