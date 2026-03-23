const express = require('express');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const cors = require('cors');
const dotenv = require('dotenv');
const sequelize = require('./database');
const apiRoutes = require('./routes/api');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Main API Route
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'WFM Server 1.0 is healthy' });
});

// Sync Database and Seed Initial Data
const Campana = require('./models/Campana');
const Configuracion = require('./models/Configuracion');
const PlanSemanal = require('./models/PlanSemanal');
const BitacoraCambio = require('./models/BitacoraCambio');
const Vacacion = require('./models/Vacacion');
const MetricaOperativa = require('./models/MetricaOperativa');
const Asistencia = require('./models/Asistencia');
const Agente = require('./models/Agente');

// Sync Database (Non-blocking for VM)
sequelize.sync({ alter: true })
    .then(async () => {
        console.log('Database synced (Alter Mode)');
        
        // Solo sembrar datos si la tabla está vacía
        const count = await Campana.count();
        if (count === 0) {
            await Campana.bulkCreate([
                { nombre: 'Retención', totalAgentes: 98, metaCapacidad: 3195 },
                { nombre: 'Móvil', totalAgentes: 26, metaCapacidad: 3195 }
            ]);

            await Configuracion.create({
                shrinkage: 0.20,
                ocupacion: 0.90,
                tmoMinutos: 11.5,
                horasTurno: 8.0,
                metaDiaria: 3195
            });
            console.log('Spec 1.0 initial seed complete (Spanish)');
        }
    })
    .catch(err => {
        console.error('⚠️ Database sync skipped (This is normal for VM):', err.message);
    });

// Start Server Always (Non-blocking for VM)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 WFM Server Ready on port ${PORT}`);
    console.log(`📡 Monitor can be accessed via VM IP or Localhost`);
});
