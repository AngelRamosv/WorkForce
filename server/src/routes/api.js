const express = require('express');
const router = express.Router();
const Pool = require('../models/Pool');
const Config = require('../models/Config');
const WeeklyPlan = require('../models/WeeklyPlan');
const AuditLog = require('../models/AuditLog');
const Vacation = require('../models/Vacation');
const DailyMetric = require('../models/DailyMetric');
const WfmService = require('../services/WfmService');
const axios = require('axios');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// --- POOLS & CONFIG ---
router.get('/pools', async (req, res) => {
    const pools = await Pool.findAll();
    res.json(pools);
});

router.put('/pools/:id', async (req, res) => {
    try {
        const { totalAgents } = req.body;
        const pool = await Pool.findByPk(req.params.id);
        if (!pool) return res.status(404).json({ error: 'Pool not found' });
        pool.totalAgents = totalAgents;
        await pool.save();
        res.json(pool);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/config', async (req, res) => {
    const config = await Config.findOne();
    res.json(config);
});

router.put('/config', async (req, res) => {
    try {
        const { shrinkage, occupancy, ahtMinutes, shiftHours } = req.body;
        let config = await Config.findOne();
        if (!config) {
            config = await Config.create({ shrinkage, occupancy, ahtMinutes, shiftHours });
        } else {
            await config.update({ shrinkage, occupancy, ahtMinutes, shiftHours });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- STAFF SYNC (REAL DATA FROM EXCEL) ---
router.post('/staff/sync', async (req, res) => {
    try {
        const { fileBase64, fileName } = req.body;

        if (!fileBase64) return res.status(400).json({ error: 'No se envió ningún archivo' });

        // Extraer base64 crudo en caso de que venga con prefix (data:application/vnd...;base64,)
        const base64Data = fileBase64.replace(/^data:.*,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        // Lógica de clasificación: 'Móvil' vs 'Retención' + conteo de Nocturnos
        let movilCount = 0;
        let retencionCount = 0;
        let retencionNocturno = 0;
        let movilNocturno = 0;

        data.forEach(row => {
            const rowStr = JSON.stringify(row).toLowerCase();
            const isMovil = rowStr.includes('movil') || rowStr.includes('móvil');
            
            // Detectar turno nocturno en la columna "Turno"
            const turno = (row['Turno'] || row['turno'] || row['TURNO'] || '').toString().toLowerCase();
            const isNocturno = turno.includes('nocturno');
            
            if (isMovil) {
                movilCount++;
                if (isNocturno) movilNocturno++;
            } else {
                retencionCount++;
                if (isNocturno) retencionNocturno++;
            }
        });

        // Actualizar pools en DB (incluyendo cantidad de nocturnos)
        const pools = await Pool.findAll();
        for (const pool of pools) {
            if (pool.name.toLowerCase().includes('retencion') || pool.name.toLowerCase().includes('retención')) {
                pool.totalAgents = retencionCount;
                pool.nocturnalAgents = retencionNocturno;
            } else if (pool.name.toLowerCase().includes('movil') || pool.name.toLowerCase().includes('móvil')) {
                pool.totalAgents = movilCount;
                pool.nocturnalAgents = movilNocturno;
            }
            await pool.save();
        }

        res.json({ 
            success: true, 
            retencionCount, 
            movilCount, 
            retencionNocturno,
            movilNocturno,
            fileName: fileName || 'Staff_Upload.xlsx' 
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar staff: ' + error.message });
    }
});

// --- VACATIONS ---
router.get('/vacations', async (req, res) => {
    const vacations = await Vacation.findAll();
    res.json(vacations);
});

router.post('/vacations', async (req, res) => {
    try {
        const vacation = await Vacation.create(req.body);
        res.json(vacation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/vacations/:id', async (req, res) => {
    await Vacation.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

// --- LIVE (PURE REAL DATA) ---
router.get('/live', async (req, res) => {
    try {
        const response = await axios.get('http://192.168.48.183:8050/data', { timeout: 3000 });
        const realData = response.data;

        if (realData.valores && Array.isArray(realData.valores)) {
            realData.tiempos_en_estado = realData.valores.map(v => `${Math.floor(v)}m`);
        }

        // El cliente ya no recibe Mocks si esto falla
        res.json(realData);
    } catch (error) {
        console.error('CRITICAL: Central Offline', error.message);
        res.status(503).json({
            error: 'Central de Datos Inalcanzable',
            message: 'Asegúrese de estar conectado a la red local de la oficina.'
        });
    }
});

// --- PLANS ---
router.get('/plans/:poolId', async (req, res) => {
    const plans = await WeeklyPlan.findAll({
        where: { poolId: req.params.poolId },
        order: [['year', 'DESC'], ['weekNumber', 'DESC']]
    });
    res.json(plans);
});

router.post('/simulate', async (req, res) => {
    const { totalAgents, distribution } = req.body;
    const balance = WfmService.calculateZeroSumBalance(totalAgents, distribution);
    res.json(balance);
});

router.post('/plans', async (req, res) => {
    const { poolId, weekNumber, year, distribution } = req.body;
    const pool = await Pool.findByPk(poolId);
    if (!pool) return res.status(404).json({ error: 'Pool not found' });

    const balance = WfmService.calculateZeroSumBalance(pool.totalAgents, distribution);
    const plan = await WeeklyPlan.create({ poolId, weekNumber, year, distribution });

    await AuditLog.create({
        entityName: 'WeeklyPlan',
        entityId: plan.id,
        action: 'Created',
        changes: { distribution, balance }
    });

    res.json({ plan, balance });
});

router.delete('/plans/:id', async (req, res) => {
    try {
        const plan = await WeeklyPlan.findByPk(req.params.id);
        if (plan) {
            await AuditLog.create({
                entityName: 'WeeklyPlan',
                entityId: plan.id,
                action: 'Deleted',
                changes: { message: `Plan de la semana ${plan.weekNumber} (${plan.year}) eliminado por el usuario.` }
            });
            await WeeklyPlan.destroy({ where: { id: req.params.id } });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AUDIT ---
router.get('/audit', async (req, res) => {
    try {
        const logs = await AuditLog.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/audit', async (req, res) => {
    try {
        await AuditLog.destroy({ where: {}, truncate: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- REPORTS / COMPLIANCE ---
router.post('/reports/save-day', async (req, res) => {
    try {
        const { poolId, totalCalls, answeredCalls, abandonedCalls, serviceLevel, totalAgentsActive } = req.body;
        const today = new Date().toISOString().split('T')[0];

        let existing = await DailyMetric.findOne({ where: { poolId, date: today } });
        if (existing) {
            await existing.update({ totalCalls, answeredCalls, abandonedCalls, serviceLevel, totalAgentsActive });
        } else {
            await DailyMetric.create({ poolId, date: today, totalCalls, answeredCalls, abandonedCalls, serviceLevel, totalAgentsActive });
        }
        res.json({ success: true, message: 'Día cerrado y guardado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/reports/compliance', async (req, res) => {
    try {
        const metrics = await DailyMetric.findAll({
            order: [['date', 'DESC']]
        });

        const complianceData = await Promise.all(metrics.map(async (metric) => {
            const pool = await Pool.findByPk(metric.poolId);
            const plan = await WeeklyPlan.findOne({
                where: { poolId: metric.poolId },
                order: [['createdAt', 'DESC']]
            });

            const dateObj = new Date(metric.date + 'T12:00:00Z');
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = dayNames[dateObj.getUTCDay()];

            let plannedAgents = 0;
            if (plan && plan.distribution && plan.distribution[dayName]) {
                plannedAgents = plan.distribution[dayName].planned || 0;
            }

            const compliancePct = plannedAgents > 0 ? Math.round((metric.totalAgentsActive / plannedAgents) * 100) : 0;

            return {
                id: metric.id,
                date: metric.date,
                poolName: pool ? pool.name : 'Unknown',
                plannedAgents,
                activeAgents: metric.totalAgentsActive,
                compliancePct,
                totalCalls: metric.totalCalls,
                abandonedCalls: metric.abandonedCalls,
                serviceLevel: metric.serviceLevel
            };
        }));

        res.json(complianceData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
