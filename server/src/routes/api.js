const express = require('express');
const router = express.Router();
const Pool = require('../models/Pool');
const Config = require('../models/Config');
const WeeklyPlan = require('../models/WeeklyPlan');
const AuditLog = require('../models/AuditLog');
const Vacation = require('../models/Vacation');
const DailyMetric = require('../models/DailyMetric');
const Attendance = require('../models/Attendance');
const Agent = require('../models/Agent');
const WfmService = require('../services/WfmService');
const axios = require('axios');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

// --- POOLS & CONFIG ---
router.get('/pools', async (req, res) => {
    const pools = await Pool.findAll();
    res.json(pools);
});

router.put('/pools/:id', async (req, res) => {
    try {
        const { totalAgents, nocturnalAgents } = req.body;
        const pool = await Pool.findByPk(req.params.id);
        if (!pool) return res.status(404).json({ error: 'Pool not found' });
        
        if (totalAgents !== undefined) pool.totalAgents = totalAgents;
        if (nocturnalAgents !== undefined) pool.nocturnalAgents = nocturnalAgents;
        
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
        const { shrinkage, occupancy, ahtMinutes, shiftHours, dailyGoal } = req.body;
        let config = await Config.findOne();
        if (!config) {
            config = await Config.create({ shrinkage, occupancy, ahtMinutes, shiftHours, dailyGoal });
        } else {
            await config.update({ shrinkage, occupancy, ahtMinutes, shiftHours, dailyGoal });
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

        // Limpiar agentes previos antes de la nueva carga (opcional, o actualizar por nombre)
        // Por simplicidad en MVP, actualizaremos si existe o crearemos si no.
        const poolsList = await Pool.findAll();

        for (const row of data) {
            const rowValues = Object.values(row).map(v => (v || '').toString().toLowerCase());
            const rowStr = rowValues.join(' ');
            
            // Clasificación de Pool
            const isMovil = rowStr.includes('movil') || rowStr.includes('móvil');
            
            // Detección de Turno y Horario
            const possibleColumns = ['turno', 'horario', 'jornada', 'shift', 'modality', 'entrada'];
            const actualColumn = Object.keys(row).find(key => 
                possibleColumns.some(pc => key.toLowerCase().includes(pc))
            );
            
            let isNocturno = false;
            const nocturnalKeywords = ['nocturno', 'night', '2:00', '2 am', 'noc', 't3', '23:', '00:', '22:'];
            let scheduledTime = '09:00'; // Default
            let shiftName = 'Matutino';

            if (actualColumn) {
                const val = row[actualColumn].toString().toLowerCase();
                isNocturno = nocturnalKeywords.some(kw => val.includes(kw));
                
                // Intentar extraer hora (formato HH:mm)
                const timeMatch = val.match(/([01]?[0-9]|2[0-3]):[0-5][0-9]/);
                if (timeMatch) scheduledTime = timeMatch[0];
            } else {
                isNocturno = nocturnalKeywords.some(kw => rowStr.includes(kw));
            }

            if (isNocturno) shiftName = 'Nocturno';

            // Detección de nombre
            const nameColumn = Object.keys(row).find(key => 
                ['nombre', 'agente', 'colaborador', 'staff', 'name'].some(n => key.toLowerCase().includes(n))
            ) || Object.keys(row)[0];

            const agentName = row[nameColumn] ? row[nameColumn].toString().trim() : 'Agente Desconocido';

            // Determinar poolId
            const targetPool = poolsList.find(p => isMovil ? p.name.toLowerCase().includes('movil') : p.name.toLowerCase().includes('retencion'));

            // Guardar Agente
            await Agent.upsert({
                name: agentName,
                poolId: targetPool ? targetPool.id : null,
                scheduledStartTime: scheduledTime,
                shift: shiftName
            });

            if (isMovil) {
                movilCount++;
                if (isNocturno) movilNocturno++;
            } else {
                retencionCount++;
                if (isNocturno) retencionNocturno++;
            }
        }

        // Actualizar pools en DB (incluyendo cantidad de nocturnos)
        for (const pool of poolsList) {
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

// --- LIVE (DATA WITH RESET LOGIC) ---
router.get('/live', async (req, res) => {
    try {
        const response = await axios.get('http://192.168.48.183:8050/data', { timeout: 3000 });
        const realData = response.data;
        const config = await Config.findOne();

        const offsetCalls = config?.offsetCalls || 0;
        const offsetAbandoned = config?.offsetAbandoned || 0;

        // Limpiar llamadas acumuladas si hay reset activo
        if (realData.llamadas_ingresadas !== undefined) {
          realData.llamadas_ingresadas = Math.max(0, realData.llamadas_ingresadas - offsetCalls);
        }
        if (realData.abandonadas_total !== undefined) {
          realData.abandonadas_total = Math.max(0, realData.abandonadas_total - offsetAbandoned);
        }
        if (realData.contestadas_total !== undefined) {
          realData.contestadas_total = Math.max(0, realData.contestadas_total - (offsetCalls - offsetAbandoned));
        }

        if (realData.valores && Array.isArray(realData.valores)) {
            realData.tiempos_en_estado = realData.valores.map(v => `${Math.floor(v)}m`);
        }

        // --- MOTOR DE ASISTENCIA (AUTOMÁTICO) ---
        const today = new Date().toISOString().split('T')[0];
        const nowTime = new Date().toLocaleTimeString('es-MX', { hour12: false, hour: '2-digit', minute: '2-digit' });

        if (realData.nombres && Array.isArray(realData.nombres)) {
            for (const name of realData.nombres) {
                // 1. Buscar si el agente tiene horario programado
                const agent = await Agent.findOne({ where: { name } });
                if (!agent) continue;

                // 2. Verificar si ya se registró su asistencia hoy
                const recorded = await Attendance.findOne({ where: { agentName: name, date: today } });
                if (!recorded) {
                    // 3. Primer login detectado: Calcular retardo
                    const [sH, sM] = agent.scheduledStartTime.split(':').map(Number);
                    const [nH, nM] = nowTime.split(':').map(Number);
                    
                    const scheduledMinutes = sH * 60 + sM;
                    const actualMinutes = nH * 60 + nM;
                    const delay = actualMinutes - scheduledMinutes;

                    const tolerance = config?.lateToleranceMinutes || 5;
                    const status = delay > tolerance ? 'Late' : 'OnTime';

                    await Attendance.create({
                        agentName: name,
                        date: today,
                        scheduledStartTime: agent.scheduledStartTime,
                        actualLoginTime: nowTime,
                        delayMinutes: Math.max(0, delay),
                        status,
                        poolId: agent.poolId
                    });
                }
            }
        }
        // --- ENRIQUECER CON TOTALES DE PUNTUALIDAD REAL ---
        const todayAttendance = await Attendance.findAll({
            where: { date: today, status: 'Late' }
        });

        const totalLoginDelay = todayAttendance.reduce((sum, a) => sum + a.delayMinutes, 0);
        
        realData.puntualidad = {
            totalLoginDelay,
            tardyEntrants: todayAttendance.map(a => ({
                name: a.agentName,
                delay: a.delayMinutes
            }))
        };

        res.json(realData);
    } catch (error) {
        console.error('CRITICAL: Central Offline', error.message);
        res.status(503).json({
            error: 'Central de Datos Inalcanzable',
            message: 'Asegúrese de estar conectado a la red local de la oficina.'
        });
    }
});

// Endpoint para reiniciar el contador (Reset Manual)
router.post('/live/reset', async (req, res) => {
    try {
        const response = await axios.get('http://192.168.48.183:8050/data', { timeout: 3000 });
        const currentTotal = response.data.llamadas_ingresadas || 0;
        const currentAbandoned = response.data.abandonadas_total || 0;

        let config = await Config.findOne();
        if (!config) {
            config = await Config.create({ offsetCalls: currentTotal, offsetAbandoned: currentAbandoned });
        } else {
            await config.update({ offsetCalls: currentTotal, offsetAbandoned: currentAbandoned });
        }

        res.json({ success: true, message: 'Filtro de reseteo aplicado', offsetApplied: currentTotal });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo leer la central para el reset' });
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
    try {
        const { poolId, weekNumber, year, distribution } = req.body;
        const pool = await Pool.findByPk(poolId);
        if (!pool) return res.status(404).json({ error: 'Pool not found' });

        const balance = WfmService.calculateZeroSumBalance(pool.totalAgents, distribution);

        // Buscar si ya existe un plan para este pool, semana y año
        let plan = await WeeklyPlan.findOne({
            where: { poolId, weekNumber, year }
        });

        if (plan) {
            // Actualizar plan existente
            await plan.update({ distribution });
            await AuditLog.create({
                entityName: 'WeeklyPlan',
                entityId: plan.id,
                action: 'Updated',
                changes: { distribution, balance }
            });
            return res.json({ plan, balance, message: 'Plan actualizado correctamente' });
        } else {
            // Crear nuevo plan
            plan = await WeeklyPlan.create({ poolId, weekNumber, year, distribution });
            await AuditLog.create({
                entityName: 'WeeklyPlan',
                entityId: plan.id,
                action: 'Created',
                changes: { distribution, balance }
            });
            return res.json({ plan, balance, message: 'Nuevo plan creado correctamente' });
        }
    } catch (error) {
        console.error('Error saving plan:', error);
        res.status(500).json({ error: error.message });
    }
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

        // 1. Guardar o actualizar la métrica diaria
        let existing = await DailyMetric.findOne({ where: { poolId, date: today } });
        if (existing) {
            await existing.update({ totalCalls, answeredCalls, abandonedCalls, serviceLevel, totalAgentsActive });
        } else {
            await DailyMetric.create({ poolId, date: today, totalCalls, answeredCalls, abandonedCalls, serviceLevel, totalAgentsActive });
        }

        // 2. REINICIO AUTOMÁTICO PARA MAÑANA: 
        // Capturamos el total actual de la central para que mañana el "nuevo día" empiece en 0.
        try {
            const centralRes = await axios.get('http://192.168.48.183:8050/data', { timeout: 3000 });
            const currentTotal = centralRes.data.llamadas_ingresadas || 0;
            const currentAbandoned = centralRes.data.abandonadas_total || 0;

            let config = await Config.findOne();
            if (config) {
                await config.update({ offsetCalls: currentTotal, offsetAbandoned: currentAbandoned });
            }
        } catch (centralError) {
            console.warn('Reinicio automático falló: No se pudo contactar a la central', centralError.message);
        }

        res.json({ success: true, message: 'Día cerrado y guardado exitosamente. Los contadores se reiniciarán para mañana.' });
    } catch (error) {
        console.error('SERVER ERROR IN save-day:', error);
        res.status(500).json({ error: 'DATABASE_ERROR: ' + error.message });
    }
});

router.delete('/reports/:id', async (req, res) => {
    try {
        await DailyMetric.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
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
            let pool = await Pool.findByPk(metric.poolId);
            
            // Si el poolId es inválido (como el '1' antiguo), buscamos el primer pool disponible
            if (!pool) {
                pool = await Pool.findOne();
            }

            const plan = await WeeklyPlan.findOne({
                where: { poolId: pool ? pool.id : metric.poolId },
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

router.get('/reports/attendance', async (req, res) => {
    try {
        const { startDate, endDate, poolId } = req.query;
        const where = {};
        if (startDate && endDate) {
            where.date = { [require('sequelize').Op.between]: [startDate, endDate] };
        }
        if (poolId) where.poolId = poolId;

        const attendance = await Attendance.findAll({
            where,
            order: [['date', 'DESC'], ['actualLoginTime', 'ASC']]
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/reports/migrate-history', async (req, res) => {
    let externalConn;
    try {
        const { startDate, endDate } = req.body;
        
        await Attendance.destroy({
            where: {
                date: { [require('sequelize').Op.between]: [startDate || '2026-03-01', endDate || '2026-03-09'] }
            }
        });

        externalConn = await mysql.createConnection({
            host: '192.168.50.33',
            user: 'cyberhub',
            password: 'masterC1berHUb#',
            database: 'cyber_ideas_hub'
        });

        const [rows] = await externalConn.execute(`
            SELECT a.personal_id, a.fecha_asistencia, MIN(a.created_at) as first_login, p.personal_nombre 
            FROM asistencias a 
            JOIN personal p ON a.personal_id = p.personal_id 
            JOIN estatus_asistencias e ON a.estatus_asistencias_id = e.estatus_asistencias_id
            WHERE a.fecha_asistencia BETWEEN ? AND ?
            AND e.descripcion IN ('Asistencia normal', 'Asistencia dia festivo', 'Retardo', 'Capacitación')
            GROUP BY a.personal_id, a.fecha_asistencia
        `, [startDate || '2026-03-01', endDate || '2026-03-09']);

        const agents = await Agent.findAll();
        const config = await Config.findOne();
        const tolerance = config?.lateToleranceMinutes || 5;

        let migratedCount = 0;
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        for (const row of rows) {
            const extTokens = normalize(row.personal_nombre).split(/\s+/).filter(t => t.length > 2);
            const localAgent = agents.find(a => {
                const locTokens = normalize(a.name).split(/\s+/).filter(t => t.length > 2);
                const matches = extTokens.filter(t => locTokens.includes(t));
                return matches.length >= 2;
            });

            if (localAgent) {
                const dateStr = row.fecha_asistencia.toISOString().split('T')[0];
                const loginDate = new Date(row.first_login);
                
                // YA NO SUBSTRAEMOS 6 HORAS. Usamos la hora tal cual viene.
                const actualTime = loginDate.toLocaleTimeString('es-MX', { hour12: false, hour: '2-digit', minute: '2-digit' });

                const [sH, sM] = localAgent.scheduledStartTime.split(':').map(Number);
                const [nH, nM] = actualTime.split(':').map(Number);
                
                const scheduledMinutes = sH * 60 + sM;
                const actualMinutes = nH * 60 + nM;
                const delay = actualMinutes - scheduledMinutes;
                
                const status = delay > tolerance ? 'Late' : 'OnTime';

                await Attendance.create({
                    agentName: localAgent.name,
                    date: dateStr,
                    scheduledStartTime: localAgent.scheduledStartTime,
                    actualLoginTime: actualTime,
                    delayMinutes: Math.max(0, delay),
                    status,
                    poolId: localAgent.poolId
                });
                migratedCount++;
            }
        }
        res.json({ success: true, message: `Migración exitosa. Se procesaron ${rows.length} registros reales.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (externalConn) await externalConn.end();
    }
});

module.exports = router;
