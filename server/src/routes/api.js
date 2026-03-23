const express = require('express');
const router = express.Router();
const Campana = require('../models/Campana');
const Configuracion = require('../models/Configuracion');
const PlanSemanal = require('../models/PlanSemanal');
const BitacoraCambio = require('../models/BitacoraCambio');
const Vacacion = require('../models/Vacacion');
const MetricaOperativa = require('../models/MetricaOperativa');
const Asistencia = require('../models/Asistencia');
const Agente = require('../models/Agente');
const WfmService = require('../services/WfmService');
const axios = require('axios');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const { Op } = require('sequelize');

// --- CAMPAÑAS & CONFIGURACIÓN ---
router.get('/pools', async (req, res) => {
    const campanas = await Campana.findAll();
    res.json(campanas);
});

router.put('/pools/:id', async (req, res) => {
    try {
        const { totalAgentes, agentesNocturnos } = req.body;
        const campana = await Campana.findByPk(req.params.id);
        if (!campana) return res.status(404).json({ error: 'Campaña no encontrada' });
        
        if (totalAgentes !== undefined) campana.totalAgentes = totalAgentes;
        if (agentesNocturnos !== undefined) campana.agentesNocturnos = agentesNocturnos;
        
        await campana.save();
        res.json(campana);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/config', async (req, res) => {
    const config = await Configuracion.findOne();
    res.json(config);
});

router.put('/config', async (req, res) => {
    try {
        const { shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria } = req.body;
        let config = await Configuracion.findOne();
        if (!config) {
            config = await Configuracion.create({ shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria });
        } else {
            await config.update({ shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria });
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
        const poolsList = await Campana.findAll();
        const possibleColumns = ['turno', 'horario', 'entrada', 'salida', 'jornada', 'shift', 'schedule', 'time'];

        for (const row of data) {
            const rowValues = Object.values(row).map(v => (v || '').toString().toLowerCase());
            const rowStr = rowValues.join(' ');
            
            // Clasificación de Pool
            const isMovil = rowStr.includes('movil') || rowStr.includes('móvil');
            
            let isNocturno = false;
            let scheduledTime = '09:00'; // Default
            let shiftName = 'Matutino';

            // FUENTE DE VERDAD PRINCIPAL: Columna 'Turno' del Excel
            const turnoDirecto = (row['Turno'] || row['turno'] || row['TURNO'] || '').toString().trim();
            if (turnoDirecto) {
                const turnoLow = turnoDirecto.toLowerCase();
                if (turnoLow.includes('nocturno') || turnoLow.includes('noche')) {
                    isNocturno = true;
                    shiftName = 'Nocturno';
                    scheduledTime = '23:00';
                } else if (turnoLow.includes('vespertino') || turnoLow.includes('tarde')) {
                    shiftName = 'Vespertino';
                    scheduledTime = '12:00';
                } else {
                    shiftName = 'Matutino';
                    scheduledTime = '09:00';
                }
            } else {
                // Respaldo: leer el horario de la fila si no hay columna Turno
                for (const key of Object.keys(row)) {
                    const val = (row[key] || '').toString().toLowerCase();
                    const keyLow = key.toLowerCase();
                    if (possibleColumns.some(pc => keyLow.includes(pc))) {
                        // Detectar nocturno por horario de inicio (23:xx o 00:xx)
                        const timeMatch = val.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]/);
                        if (timeMatch) {
                            scheduledTime = timeMatch[0];
                            const startHour = parseInt(timeMatch[0].split(':')[0]);
                            if (startHour >= 22 || startHour <= 2) {
                                isNocturno = true;
                                shiftName = 'Nocturno';
                            } else if (startHour >= 12) {
                                shiftName = 'Vespertino';
                            }
                        }
                    }
                }
            }

            // Detección de nombre
            const nameColumn = Object.keys(row).find(key => 
                ['nombre', 'agente', 'colaborador', 'staff', 'name'].some(n => key.toLowerCase().includes(n))
            ) || Object.keys(row)[0];

            const agentName = row[nameColumn] ? row[nameColumn].toString().trim() : 'Agente Desconocido';

            const normalizeStr = (s) => (s || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const rowStrNormalized = normalizeStr(rowStr);

            // Determinar poolId
            const targetPool = poolsList.find(p => {
                const pName = normalizeStr(p.nombre);
                return isMovil ? pName.includes('movil') : pName.includes('retencion');
            });

            // Guardar Agente
            await Agente.upsert({
                nombre: agentName,
                campanaId: targetPool ? targetPool.id : null,
                horaEntradaProgramada: scheduledTime,
                numero_agente: row['Nómina'] || row['Nomina'] || row['ID'] || row['numero_agente'],
                turno: shiftName
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
            if (pool.nombre.toLowerCase().includes('retencion') || pool.nombre.toLowerCase().includes('retención')) {
                pool.totalAgentes = retencionCount;
                pool.agentesNocturnos = retencionNocturno;
            } else if (pool.nombre.toLowerCase().includes('movil') || pool.nombre.toLowerCase().includes('móvil')) {
                pool.totalAgentes = movilCount;
                pool.agentesNocturnos = movilNocturno;
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

// --- VACACIONES ---
router.get('/vacations', async (req, res) => {
    const vacations = await Vacacion.findAll();
    res.json(vacations);
});

router.post('/vacations', async (req, res) => {
    try {
        const vacation = await Vacacion.create(req.body);
        res.json(vacation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/vacations/:id', async (req, res) => {
    await Vacacion.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

// --- LIVE (DATA WITH RESET LOGIC) ---
router.get('/live', async (req, res) => {
    try {
        let response;
        try {
            response = await axios.get('http://192.168.48.183:8050/data', { timeout: 10000 });
        } catch (centralError) {
            console.error('CRITICAL: Dashboard Central Offline', centralError.message);
            return res.status(503).json({
                error: 'Central de Datos Inalcanzable (KPIs)',
                message: `El servidor de métricas no respondió (Timeout 10s). Detalle: ${centralError.message}`,
                type: 'CENTRAL_OFFLINE'
            });
        }

        const realData = response.data;
        const config = await Configuracion.findOne();

        const offsetCalls = config?.ajusteLlamadas || 0;
        const offsetAbandoned = config?.ajusteAbandonadas || 0;

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

        // --- MOTOR DE ASISTENCIA (SÓLO LECTURA PARA DASHBOARD) ---
        try {
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
            
            const todayAttendance = await Asistencia.findAll({
                where: { fecha: today, estatusAsistencia: 'Retardo' }
            });

            const totalLoginDelay = todayAttendance
                .filter(a => a.horaEntradaProgramada !== '23:00')
                .reduce((sum, a) => sum + a.minutosRetardo, 0);
            
            realData.puntualidad = {
                totalLoginDelay,
                tardyEntrants: todayAttendance.map(a => ({
                    name: a.nombreAgente,
                    delay: a.minutosRetardo
                }))
            };
        } catch (dbError) {
            console.error('ERROR: Database Query for Live Dashboard', dbError.message);
            // Si la BD falla, no bloqueamos el dashboard completo, enviamos datos vacíos de puntualidad
            realData.puntualidad = { totalLoginDelay: 0, tardyEntrants: [], notice: 'Datos de asistencia temporalmente no disponibles' };
        }

        res.json(realData);
    } catch (generalError) {
        console.error('FATAL LIVE ERROR:', generalError.message);
        res.status(500).json({ error: 'Error interno del servidor', message: generalError.message });
    }
});

// Endpoint para reiniciar el contador (Reset Manual)
router.post('/live/reset', async (req, res) => {
    try {
        const response = await axios.get('http://192.168.48.183:8050/data', { timeout: 10000 });
        const currentTotal = response.data.llamadas_ingresadas || 0;
        const currentAbandoned = response.data.abandonadas_total || 0;

        let config = await Configuracion.findOne();
        if (!config) {
            config = await Configuracion.create({ ajusteLlamadas: currentTotal, ajusteAbandonadas: currentAbandoned });
        } else {
            await config.update({ ajusteLlamadas: currentTotal, ajusteAbandonadas: currentAbandoned });
        }

        res.json({ success: true, message: 'Filtro de reseteo aplicado', offsetApplied: currentTotal });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo leer la central para el reset' });
    }
});

// --- PLANES ---
router.get('/plans/:poolId', async (req, res) => {
    const plans = await PlanSemanal.findAll({
        where: { campanaId: req.params.poolId },
        order: [['anio', 'DESC'], ['numeroSemana', 'DESC']]
    });
    res.json(plans);
});

router.post('/simulate', async (req, res) => {
    const { totalAgents, distribution, agentesNocturnos } = req.body;
    const effectiveTotal = (totalAgents || 0) - (agentesNocturnos || 0);
    const balance = WfmService.calculateZeroSumBalance(effectiveTotal, distribution);
    res.json(balance);
});

router.post('/plans', async (req, res) => {
    try {
        const { poolId, weekNumber, year, distribution } = req.body;
        const pool = await Campana.findByPk(poolId);
        if (!pool) return res.status(404).json({ error: 'Campaña no encontrada' });

        // EXCLUSIÓN NOCTURNOS PARA IA (Spec 1.1)
        const effectiveTotalAgents = (pool.totalAgentes || 0) - (pool.agentesNocturnos || 0);
        const balance = WfmService.calculateZeroSumBalance(effectiveTotalAgents, distribution);

        // Buscar si ya existe un plan para este pool, semana y año
        let plan = await PlanSemanal.findOne({
            where: { campanaId: poolId, numeroSemana: weekNumber, anio: year }
        });

        if (plan) {
            // Actualizar plan existente
            await plan.update({ distribucion: distribution });
            await BitacoraCambio.create({
                nombreEntidad: 'PlanSemanal',
                idEntidad: plan.id,
                accion: 'Actualizado',
                cambios: { distribucion: distribution, balance }
            });
            return res.json({ plan, balance, message: 'Plan actualizado correctamente' });
        } else {
            // Crear nuevo plan
            plan = await PlanSemanal.create({ campanaId: poolId, numeroSemana: weekNumber, anio: year, distribucion: distribution });
            await BitacoraCambio.create({
                nombreEntidad: 'PlanSemanal',
                idEntidad: plan.id,
                accion: 'Creado',
                cambios: { distribucion: distribution, balance }
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
        const plan = await PlanSemanal.findByPk(req.params.id);
        if (plan) {
            await BitacoraCambio.create({
                nombreEntidad: 'PlanSemanal',
                idEntidad: plan.id,
                accion: 'Eliminado',
                cambios: { message: `Plan de la semana ${plan.numeroSemana} (${plan.anio}) eliminado por el usuario.` }
            });
            await PlanSemanal.destroy({ where: { id: req.params.id } });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AUDITORÍA ---
router.get('/audit', async (req, res) => {
    try {
        const logs = await BitacoraCambio.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/audit', async (req, res) => {
    try {
        await BitacoraCambio.destroy({ where: {}, truncate: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- REPORTES / CUMPLIMIENTO ---
router.post('/reports/save-day', async (req, res) => {
    try {
        const { poolId, totalCalls, answeredCalls, abandonedCalls, serviceLevel, totalAgentsActive } = req.body;
        const today = new Date().toISOString().split('T')[0];

        // 1. Guardar o actualizar la métrica operativa
        let existing = await MetricaOperativa.findOne({ where: { campanaId: poolId, fecha: today } });
        if (existing) {
            await existing.update({ 
                totalLlamadas: totalCalls, 
                llamadasContestadas: answeredCalls, 
                llamadasAbandonadas: abandonedCalls, 
                nivelServicio: serviceLevel, 
                totalAgentesActivos: totalAgentsActive 
            });
        } else {
            await MetricaOperativa.create({ 
                campanaId: poolId, 
                fecha: today, 
                totalLlamadas: totalCalls, 
                llamadasContestadas: answeredCalls, 
                llamadasAbandonadas: abandonedCalls, 
                nivelServicio: serviceLevel, 
                totalAgentesActivos: totalAgentsActive 
            });
        }

        // 2. REINICIO AUTOMÁTICO PARA MAÑANA: 
        try {
            const centralRes = await axios.get('http://192.168.48.183:8050/data', { timeout: 3000 });
            const currentTotal = centralRes.data.llamadas_ingresadas || 0;
            const currentAbandoned = centralRes.data.abandonadas_total || 0;

            let config = await Configuracion.findOne();
            if (config) {
                await config.update({ ajusteLlamadas: currentTotal, ajusteAbandonadas: currentAbandoned });
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

// --- BORRADO DE ASISTENCIA ---
router.delete('/reports/attendance', async (req, res) => {
    try {
        const { startDate, endDate, poolId } = req.query;
        const where = {};
        
        if (startDate && endDate) {
            where.fecha = { [Op.between]: [startDate, endDate] };
        }
        if (poolId) where.campanaId = poolId;

        let deletedCount;
        // Si no hay filtros, borrar TODO (truncate para mayor velocidad)
        if (Object.keys(where).length === 0) {
            await Asistencia.destroy({ where: {}, truncate: true });
            deletedCount = 'todos';
        } else {
            deletedCount = await Asistencia.destroy({ where });
        }
        
        res.json({ success: true, deletedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/reports/attendance/:id', async (req, res) => {
    try {
        await Asistencia.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/reports/:id', async (req, res) => {
    try {
        await MetricaOperativa.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/reports/compliance', async (req, res) => {
    try {
        const metrics = await MetricaOperativa.findAll({
            order: [['fecha', 'DESC']]
        });

        const complianceData = await Promise.all(metrics.map(async (metric) => {
            let pool = await Campana.findByPk(metric.campanaId);
            
            if (!pool) {
                pool = await Campana.findOne();
            }

            const plan = await PlanSemanal.findOne({
                where: { campanaId: pool ? pool.id : metric.campanaId },
                order: [['createdAt', 'DESC']]
            });

            const dateObj = new Date(metric.fecha + 'T12:00:00Z');
            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
            const dayName = dayNames[dateObj.getUTCDay()];

            let plannedAgents = 0;
            if (plan && plan.distribucion && plan.distribucion[dayName]) {
                plannedAgents = plan.distribucion[dayName].planned || 0;
            }

            const compliancePct = plannedAgents > 0 ? Math.round((metric.totalAgentesActivos / plannedAgents) * 100) : 0;

            return {
                id: metric.id,
                date: metric.fecha,
                poolName: pool ? pool.nombre : 'Desconocido',
                plannedAgents,
                activeAgents: metric.totalAgentesActivos,
                compliancePct,
                totalCalls: metric.totalLlamadas,
                abandonedCalls: metric.llamadasAbandonadas,
                serviceLevel: metric.nivelServicio
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
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });

        // Si consultamos hoy (y no es una fecha histórica de largo plazo), sincronizamos primero
        if (!startDate || startDate === today) {
            await syncAttendanceFromCentral(today);
        }

        const where = {};
        if (startDate && endDate) {
            where.fecha = { [Op.between]: [startDate, endDate] };
        } else {
            where.fecha = today;
        }
        if (poolId) where.campanaId = poolId;

        const attendance = await Asistencia.findAll({
            where,
            order: [['fecha', 'DESC'], ['horaEntradaReal', 'ASC']]
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Función Maestra de Sincronización (Solo se llama bajod demanda)
async function syncAttendanceFromCentral(targetDate) {
console.log("Running sync for", targetDate);
    try {
        const allAgents = await Agente.findAll();
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        // 1. Obtener TODOS los registros de productividad de hoy desde la VM
        let productivityData = [];
        try {
            const prodConn = await mysql.createConnection({
                host: '192.168.50.33',
                user: 'cyberhub',
                password: 'masterC1berHUb#',
                database: 'cyber_ideas_hub'
            });
            // Filtro por FechaCaptura para asegurar que procesamos solo lo de hoy
            const [rows] = await prodConn.execute(
                'SELECT numero_agente, nombre_agente, tiempo_logueado, FechaCaptura FROM reporteProductividad WHERE DATE(FechaCaptura) = ? AND tiempo_logueado > "00:00:00" ORDER BY id DESC',
                [targetDate]
            );
            productivityData = rows;
            await prodConn.end();
        } catch (err) {
            console.error('Sync Database error:', err.message);
        }

        if (productivityData.length === 0) {
console.log("No productivity data! Aborting.");
return;
}
console.log("Got prod data length:", productivityData.length);

        // 2. Filtrar ya grabados para hoy
        console.log("Processing agents...");
const existingEntries = await Asistencia.findAll({ where: { fecha: targetDate } });
        const recordedNames = new Set(existingEntries.map(a => a.nombreAgente));

        const nowTime = new Date().toLocaleTimeString('es-MX', { hour12: false, hour: '2-digit', minute: '2-digit' });

        for (const agent of allAgents) {
            // Intentar emparejar por número de agente numéricamente (evita problemas de ceros a la izquierda)
            let prodRow = productivityData.find(p => Number(p.numero_agente) === Number(agent.numero_agente));
            
            if (!prodRow) {
                const localTokens = normalize(agent.nombre).split(/\s+/).filter(t => t.length > 2 || t.length === 1); 
                
                let bestMatch = null;
                let maxMatches = 0;

                for (const p of productivityData) {
                    const prodTokens = normalize(p.nombre_agente).split(/[\s\.]+/).filter(t => t.length > 2 || t.length === 1);
                    const matchCount = prodTokens.filter(pt => localTokens.includes(pt)).length;
                    
                    if (matchCount > maxMatches) {
                        maxMatches = matchCount;
                        bestMatch = p;
                    }
                }
                
                if (maxMatches >= 1) {
                    prodRow = bestMatch;
                }
            }

            let officialLoginTime = agent.horaEntradaProgramada; // Asumir a tiempo si no hay datos
            let delayMinutos = 0;
            let loggedTimeStr = null;

            if (prodRow && prodRow.tiempo_logueado) {
                loggedTimeStr = prodRow.tiempo_logueado;
                const [h, m, s] = prodRow.tiempo_logueado.split(':').map(Number);
                const totalSeconds = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
                
                // CÁLCULO MATEMÁTICO: Hora Actual de la app - Tiempo Logueado de CCPulse
                const loginDate = new Date(Date.now() - totalSeconds * 1000);

                officialLoginTime = loginDate.toLocaleTimeString('es-MX', {
                    timeZone: 'America/Mexico_City',
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const [sH, sM] = agent.horaEntradaProgramada.split(':').map(Number);
                const loginMx = new Date(loginDate.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
                delayMinutos = Math.max(0, (loginMx.getHours() * 60 + loginMx.getMinutes()) - (sH * 60 + sM));
            }

            const config = await Configuracion.findOne();
            const tolerance = config?.toleranciaRetardoMinutos || 5;
            const tmo = config?.tmoMinutos || 11.5;

            const existingEntry = existingEntries.find(e => e.nombreAgente === agent.nombre);

            let estatusAsistencia = delayMinutos > tolerance ? 'Retardo' : 'A Tiempo';
            let impacto = delayMinutos === 0 ? 0 : Math.round(delayMinutos / tmo);

            if (!loggedTimeStr) {
                estatusAsistencia = 'Ausente';
                delayMinutos = 0;
                impacto = 0;
                officialLoginTime = agent.horaEntradaProgramada;
            }

            if (existingEntry) {
                // Si el agente ya existe y el CyberHub le trajo un tiempo logueado mayor, lo actualizamos.
                // Si CyberHub no trajo (prodRow no existe), mantenemos el que teníamos.
                if (loggedTimeStr) {
                    await existingEntry.update({
                        tiempoLogueado: loggedTimeStr
                    });
                }
            } else if (!recordedNames.has(agent.nombre)) {
                // Crear nuevo registro para TODA la plantilla (estén o no en CyberHub)
                await Asistencia.create({
                    id: require('crypto').randomUUID(),
                    nombreAgente: agent.nombre,
                    fecha: targetDate,
                    horaEntradaProgramada: agent.horaEntradaProgramada,
                    horaEntradaReal: officialLoginTime,
                    tiempoLogueado: loggedTimeStr,
                    minutosRetardo: delayMinutos,
                    impactoLlamadas: impacto,
                    estatusAsistencia: estatusAsistencia,
                    campanaId: agent.campanaId
                });
                recordedNames.add(agent.nombre);
            }
        }
    } catch (e) {
        console.error('Full Sync Failed:', e.message);
    }
}

router.get('/reports/attendance/export', async (req, res) => {
    try {
        const { startDate, endDate, poolId } = req.query;
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });

        // Sincronizar si es reporte de hoy
        if (!startDate || startDate === today) {
            await syncAttendanceFromCentral(today);
        }

        const where = {};
        if (startDate && endDate) {
            where.fecha = { [Op.between]: [startDate, endDate] };
        } else {
            where.fecha = today;
        }
        if (poolId) where.campanaId = poolId;

        const attendance = await Asistencia.findAll({
            where,
            order: [['fecha', 'ASC'], ['nombreAgente', 'ASC']]
        });

        const validAttendance = attendance.filter(a => a.estatusAsistencia !== 'Ausente');

        const data = validAttendance.map(a => ({
            'Agente': a.nombreAgente,
            'Entrada Programada': a.horaEntradaProgramada,
            'Entrada Real': a.horaEntradaReal,
            'Tiempo Logueado': a.tiempoLogueado || '-',
            'Minutos Retardo': a.minutosRetardo,
            'Impacto (Llamadas)': a.impactoLlamadas > 0 ? `-${a.impactoLlamadas}` : '0',
            'Estatus': a.estatusAsistencia === 'Retardo' ? 'RETARDO' : 'A TIEMPO'
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, "Asistencia");

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_Asistencia_${startDate}_${endDate}.xlsx`);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.post('/reports/migrate-history', async (req, res) => {
    let externalConn;
    try {
        const { startDate, endDate } = req.body;
        
        await Asistencia.destroy({
            where: {
                fecha: { [Op.between]: [startDate || '2026-03-01', endDate || '2026-03-09'] }
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

        const agents = await Agente.findAll();
        const config = await Configuracion.findOne();
        const tolerance = config?.toleranciaRetardoMinutos || 5;
        const tmo = config?.tmoMinutos || 11.5;

        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        for (const row of rows) {
            const extTokens = normalize(row.personal_nombre).split(/\s+/).filter(t => t.length > 2);
            const localAgent = agents.find(a => {
                const locTokens = normalize(a.nombre).split(/\s+/).filter(t => t.length > 2);
                const matches = extTokens.filter(t => locTokens.includes(t));
                return matches.length >= 2;
            });

            if (localAgent) {
                const dateStr = row.fecha_asistencia.toISOString().split('T')[0];
                const loginDate = new Date(row.first_login);
                const actualTime = loginDate.toLocaleTimeString('es-MX', { hour12: false, hour: '2-digit', minute: '2-digit' });

                const [sH, sM] = localAgent.horaEntradaProgramada.split(':').map(Number);
                const [nH, nM] = actualTime.split(':').map(Number);
                
                const scheduledMinutes = sH * 60 + sM;
                const actualMinutes = nH * 60 + nM;
                const delay = actualMinutes - scheduledMinutes;
                
                const delayMinutos = Math.max(0, delay);
                const impacto = Math.round(delayMinutos / tmo);

                await Asistencia.create({
                    nombreAgente: localAgent.nombre,
                    fecha: dateStr,
                    horaEntradaProgramada: localAgent.horaEntradaProgramada,
                    horaEntradaReal: actualTime,
                    minutosRetardo: delayMinutos,
                    impactoLlamadas: impacto,
                    estatusAsistencia: delay > tolerance ? 'Retardo' : 'A Tiempo',
                    campanaId: localAgent.campanaId
                });
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
