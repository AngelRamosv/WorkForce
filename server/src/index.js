const express = require('express');
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
const Pool = require('./models/Pool');
const Config = require('./models/Config');
const WeeklyPlan = require('./models/WeeklyPlan');
const AuditLog = require('./models/AuditLog');
const Vacation = require('./models/Vacation');
const DailyMetric = require('./models/DailyMetric');

sequelize.sync({ force: false }).then(async () => {
    console.log('Database synced (Persistent Mode)');

    // Solo sembrar datos si la tabla está vacía
    const count = await Pool.count();
    if (count === 0) {
        await Pool.bulkCreate([
            { name: 'Retención', totalAgents: 98, capacityGoal: 3195 },
            { name: 'Móvil', totalAgents: 26, capacityGoal: 3195 }
        ]);

        await Config.create({
            shrinkage: 0.20,
            occupancy: 0.90,
            ahtMinutes: 11.5,
            shiftHours: 8.0,
            dailyGoal: 3195
        });
        console.log('Spec 1.0 initial seed complete');
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://192.168.51.123:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to sync database:', err);
});
