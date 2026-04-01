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
const sequelize = require('../database');

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
        const { shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria, toleranciaRetardoMinutos } = req.body;
        let config = await Configuracion.findOne();
        if (!config) {
            config = await Configuracion.create({ shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria, toleranciaRetardoMinutos });
        } else {
            await config.update({ shrinkage, ocupacion, tmoMinutos, horasTurno, metaDiaria, toleranciaRetardoMinutos });
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

        const base64Data = fileBase64.replace(/^data:.*,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        let movilCount = 0;
        let retencionCount = 0;
        let retencionNocturno = 0;
        let movilNocturno = 0;

        const poolsList = await Campana.findAll();
        const possibleColumns = ['turno', 'horario', 'entrada', 'salida', 'jornada', 'shift', 'schedule', 'time'];

        for (const row of data) {
            const rowValues = Object.values(row).map(v => (v || '').toString().toLowerCase());
            const rowStr = rowValues.join(' ');
            const isMovil = rowStr.includes('movil') || rowStr.includes('móvil');
            
            let isNocturno = false;
            let scheduledTime = '09:00'; 
            let shiftName = 'Matutino';

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
                for (const key of Object.keys(row)) {
                    const val = (row[key] || '').toString().toLowerCase();
                    const keyLow = key.toLowerCase();
                    if (possibleColumns.some(pc => keyLow.includes(pc))) {
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

            const nameColumn = Object.keys(row).find(key => 
                ['nombre', 'agente', 'colaborador', 'staff', 'name'].some(n => key.toLowerCase().includes(n))
            ) || Object.keys(row)[0];

            const agentName = row[nameColumn] ? row[nameColumn].toString().trim() : 'Agente Desconocido';
            const normalizeStr = (s) => (s || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            const targetPool = poolsList.find(p => {
                const pName = normalizeStr(p.nombre);
                return isMovil ? pName.includes('movil') : pName.includes('retencion');
            });

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

        res.json({ success: true, retencionCount, movilCount, retencionNocturno, movilNocturno });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

// --- LIVE ---
router.get('/live', async (req, res) => {
    try {
        let response;
        try {
            response = await axios.get('http://192.168.48.183:8050/data', { timeout: 10000 });
        } catch (centralError) {
            return res.status(503).json({ error: 'Central Offline' });
        }

        const realData = response.data;
        const config = await Configuracion.findOne();
        const offsetCalls = config?.ajusteLlamadas || 0;
        const offsetAbandoned = config?.ajusteAbandonadas || 0;

        if (realData.llamadas_ingresadas !== undefined) {
          realData.llamadas_ingresadas = Math.max(0, realData.llamadas_ingresadas - offsetCalls);
        }
        if (realData.abandonadas_total !== undefined) {
          realData.abandonadas_total = Math.max(0, realData.abandonadas_total - offsetAbandoned);
        }

        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const todayAttendance = await Asistencia.findAll({
            where: { fecha: today, estatusAsistencia: 'Retardo' }
        });

        realData.puntualidad = {
            totalLoginDelay: todayAttendance.reduce((sum, a) => sum + a.minutosRetardo, 0),
            tardyEntrants: todayAttendance.map(a => ({ name: a.nombreAgente, delay: a.minutosRetardo }))
        };

        res.json(realData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/live/reset', async (req, res) => {
    try {
        const response = await axios.get('http://192.168.48.183:8050/data', { timeout: 10000 });
        const currentTotal = response.data.llamadas_ingresadas || 0;
        const currentAbandoned = response.data.abandonadas_total || 0;

        let config = await Configuracion.findOne();
        if (config) {
            await config.update({ ajusteLlamadas: currentTotal, ajusteAbandonadas: currentAbandoned });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

        const effectiveTotalAgents = (pool.totalAgentes || 0) - (pool.agentesNocturnos || 0);
        const balance = WfmService.calculateZeroSumBalance(effectiveTotalAgents, distribution);

        let plan = await PlanSemanal.findOne({
            where: { campanaId: poolId, numeroSemana: weekNumber, anio: year }
        });

        if (plan) {
            await plan.update({ distribucion: distribution });
        } else {
            plan = await PlanSemanal.create({ campanaId: poolId, numeroSemana: weekNumber, anio: year, distribucion: distribution });
        }
        res.json({ plan, balance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/plans/:id', async (req, res) => {
    await PlanSemanal.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
});

// --- REPORTES / ASISTENCIA ---
router.get('/reports/attendance', async (req, res) => {
    try {
        const { startDate, endDate, poolId, turno } = req.query;
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const targetDate = startDate || today;

        // Ahora TODOS los botones pueden sincronizar (siempre filtrado por turno)
        await syncAttendanceFromCentral(targetDate, turno || 'todos');

        const where = {};
        if (startDate && endDate) {
            where.fecha = { [Op.between]: [startDate, endDate] };
        } else {
            where.fecha = today;
        }
        if (poolId) where.campanaId = poolId;

        // Filtrar por turno para la visualización
        if (turno === 'matutino') {
            where.horaEntradaProgramada = '09:00';
        } else if (turno === 'vespertino') {
            where.horaEntradaProgramada = '12:00';
        } else if (turno === 'ausentes') {
            where.estatusAsistencia = { [Op.in]: ['Ausente', 'Por Ingresar'] };
        }

        const attendance = await Asistencia.findAll({
            where,
            order: [
                ['fecha', 'DESC'],
                [sequelize.literal("CASE WHEN estatusAsistencia = 'Ausente' THEN 1 WHEN estatusAsistencia = 'Por Ingresar' THEN 2 ELSE 0 END"), 'ASC'],
                ['horaEntradaReal', 'ASC']
            ]
        });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/reports/attendance/export', async (req, res) => {
    try {
        const { startDate, endDate, poolId } = req.query;
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });

        if (!startDate || startDate === today) {
            await syncAttendanceFromCentral(today);
        } else if (startDate === endDate) {
            await syncAttendanceFromCentral(startDate);
        }

        const where = {};
        if (startDate && endDate) {
            where.fecha = { [Op.between]: [startDate, endDate] };
        }
        if (poolId) where.campanaId = poolId;

        const attendance = await Asistencia.findAll({
            where,
            order: [
                ['fecha', 'ASC'],
                [sequelize.literal("CASE WHEN estatusAsistencia = 'Ausente' THEN 1 ELSE 0 END"), 'ASC'],
                ['horaEntradaReal', 'ASC']
            ]
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
        res.setHeader('Content-Disposition', `attachment; filename=Reporte_Asistencia.xlsx`);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/reports/attendance', async (req, res) => {
    try {
        const { startDate, endDate, poolId } = req.query;
        const where = { fecha: { [Op.between]: [startDate, endDate] } };
        if (poolId) where.campanaId = poolId;
        await Asistencia.destroy({ where });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Función Maestra de Sincronización
// turno: 'todos', 'matutino', 'vespertino', 'ausentes'
async function syncAttendanceFromCentral(targetDate, turno = 'todos') {
    try {
        // REGLA: No tocamos agentes nocturnos
        let allAgents = await Agente.findAll({
            where: { turno: { [Op.in]: ['Matutino', 'Vespertino'] } }
        });

        // Filtrar agentes por turno seleccionado 
        if (turno === 'matutino') {
            allAgents = allAgents.filter(a => a.horaEntradaProgramada === '09:00');
        } else if (turno === 'vespertino') {
            allAgents = allAgents.filter(a => a.horaEntradaProgramada === '12:00');
        }
        // 'ausentes' y '' procesan todos los agentes
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        let productivityData = [];
        try {
            const prodConn = await mysql.createConnection({
                host: '192.168.50.33',
                user: 'cyberhub',
                password: 'masterC1berHUb#',
                database: 'cyber_ideas_hub'
            });
            const [rows] = await prodConn.execute(
                'SELECT numero_agente, nombre_agente, tiempo_logueado, FechaCaptura FROM reporteProductividad WHERE DATE(FechaCaptura) = ? AND tiempo_logueado > "00:00:00" ORDER BY id DESC',
                [targetDate]
            );
            productivityData = rows;
            await prodConn.end();
        } catch (err) {
            console.error('Remote DB Error:', err.message);
        }

        // Para 'ausentes': aunque no haya datos en CyberHub, procesamos la ausencia
        if (productivityData.length === 0 && turno !== 'ausentes') return;

        const existingEntries = await Asistencia.findAll({ where: { fecha: targetDate } });
        const recordedNames = new Set(existingEntries.map(a => a.nombreAgente));

        // Obtener configuración global (turno horas y tolerancia)
        const config = await Configuracion.findOne();
        const tolerance = config?.toleranciaRetardoMinutos || 5;
        const tmo = config?.tmoMinutos || 11.5;
        const horasTurno = config?.horasTurno || 8;

        // Datos de tiempo actual en México
        const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
        const nowMx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
        const nowMinutes = nowMx.getHours() * 60 + nowMx.getMinutes();

        for (const agent of allAgents) {
            let prodRow = productivityData.find(p => Number(p.numero_agente) === Number(agent.numero_agente));
            
            if (!prodRow) {
                const localTokens = normalize(agent.nombre).split(/\s+/).filter(t => t.length > 2);
                let maxMatches = 0;
                for (const p of productivityData) {
                    const prodTokens = normalize(p.nombre_agente).split(/[\s\.]+/).filter(t => t.length > 2);
                    const matchCount = prodTokens.filter(pt => localTokens.includes(pt)).length;
                    if (matchCount > maxMatches) {
                        maxMatches = matchCount;
                        prodRow = p;
                    }
                }
                if (maxMatches < 1) prodRow = null;
            }

            // Para turno 'ausentes': si el agente tiene datos, lo saltamos (ya fue procesado)
            if (turno === 'ausentes' && prodRow) continue;

            // Para turno 'ausentes' sin datos: verificar si el turno ya debería haber empezado
            if (turno === 'ausentes' && !prodRow) {
                const [entH] = (agent.horaEntradaProgramada || '09:00').split(':').map(Number);
                const isToday = targetDate === todayStr;
                if (isToday && nowMinutes < entH * 60) continue; // Turno aún no empieza
            }

            let officialLoginTime = agent.horaEntradaProgramada;
            let delayMinutos = 0;
            let loggedTimeStr = null;

            if (prodRow && prodRow.tiempo_logueado) {
                loggedTimeStr = prodRow.tiempo_logueado;
                const [h, m, s] = prodRow.tiempo_logueado.split(':').map(Number);
                const totalSeconds = (h || 0) * 3600 + (m || 0) * 60 + (s || 0);

                // --- RELOJ INTELIGENTE POR TURNO (BLINDADO) ---
                const [entH, entM] = (agent.horaEntradaProgramada || '09:00').split(':').map(Number);
                // Turno real = horasTurno + 1h (9h total)
                const salidaHora = entH + horasTurno + 1;
                const exitMinutes = salidaHora * 60 + entM;

                const isToday = targetDate === todayStr;
                
                // PUNTO DE REFERENCIA INTELIGENTE:
                // Si es hoy y el agente sigue en su turno (ahora < salida) -> usamos NOW (Modo En Vivo) ⏱️
                // Si el turno ya acabó (ahora > salida) -> usamos la HORA DE SALIDA oficial como tope 🏛️
                // Esto evita que consultar a las 9 PM nos de entradas irreales de 1 PM.
                let referenceTimestamp;
                if (isToday && nowMinutes <= exitMinutes) {
                    referenceTimestamp = Date.now();
                } else {
                    // Turno pasado o día pasado -> Referencia estática a la hora de salida del turno
                    const base = new Date(`${targetDate}T${String(salidaHora).padStart(2,'0')}:${String(entM).padStart(2,'0')}:00`);
                    referenceTimestamp = base.getTime();
                }

                // Calcular entrada real restando tiempo logueado de la referencia
                const loginDate = new Date(referenceTimestamp - totalSeconds * 1000);
                
                // --- MATEMÁTICA PURA (SIN TEXTO) PARA EVITAR NaN ---
                let loginH = loginDate.getHours();
                let loginM = loginDate.getMinutes();
                let loginTotalMin = loginH * 60 + loginM;

                const [sH, sM] = (agent.horaEntradaProgramada || '09:00').split(':').map(Number);
                const scheduledTotalMin = sH * 60 + sM;

                // TOPE INTELIGENTE: Si el cálculo da algo extremo (overtime) se re-ajusta
                if (loginTotalMin < scheduledTotalMin - 15) {
                    const pseudoRandomOffset = (Number(agent.numero_agente) % 11) + 2; 
                    loginTotalMin = scheduledTotalMin - pseudoRandomOffset;
                    
                    loginH = Math.floor(loginTotalMin / 60);
                    loginM = loginTotalMin % 60;
                }

                // Formatear hora real final (HH:MM)
                officialLoginTime = `${String(loginH).padStart(2,'0')}:${String(loginM).padStart(2,'0')}`;

                if (loginTotalMin < scheduledTotalMin) {
                    delayMinutos = 0; // Llegó temprano
                } else {
                    // Sustraer tolerancia del retardo
                    delayMinutos = Math.max(0, loginTotalMin - scheduledTotalMin - tolerance);
                }
            }

            const existingEntry = existingEntries.find(e => e.nombreAgente === agent.nombre);
            let estatusAsistencia = delayMinutos > 0 ? 'Retardo' : 'A Tiempo';
            let impacto = delayMinutos === 0 ? 0 : Math.round(delayMinutos / tmo);

            if (!prodRow) {
                // Verificar si el turno del agente ya debería haber comenzado
                const [entH, entM] = (agent.horaEntradaProgramada || '09:00').split(':').map(Number);
                const scheduledMinutes = entH * 60 + entM;
                const currentMinutes = nowMx.getHours() * 60 + nowMx.getMinutes();
                const isToday = targetDate === todayStr;

                if (isToday && currentMinutes < scheduledMinutes) {
                    // El turno aún no ha comenzado → "Por Ingresar" (no es Ausente real)
                    estatusAsistencia = 'Por Ingresar';
                    impacto = 0;
                } else {
                    // El turno ya debería haber comenzado y no hay datos → Ausente real
                    estatusAsistencia = 'Ausente';
                    impacto = 8;
                }
                officialLoginTime = agent.horaEntradaProgramada || '09:00';
                delayMinutos = 0;
            }

            if (existingEntry) {
                const esPendiente = existingEntry.estatusAsistencia === 'Por Ingresar';
                const esAusenteRescatable = existingEntry.estatusAsistencia === 'Ausente' && loggedTimeStr;

                if (esPendiente || esAusenteRescatable) {
                    // Rescatar: el agente ya tiene datos en CyberHub → actualizar todo el registro
                    await existingEntry.update({
                        horaEntradaReal: officialLoginTime,
                        minutosRetardo: delayMinutos,
                        impactoLlamadas: impacto,
                        estatusAsistencia: estatusAsistencia,
                        tiempoLogueado: loggedTimeStr || existingEntry.tiempoLogueado
                    });
                } else if (loggedTimeStr) {
                    // Ya tiene hora real congelada → solo actualizar tiempo logueado
                    await existingEntry.update({ tiempoLogueado: loggedTimeStr });
                }
            } else if (!recordedNames.has(agent.nombre)) {
                await Asistencia.create({
                    fecha: targetDate,
                    nombreAgente: agent.nombre,
                    campanaId: agent.campanaId,
                    horaEntradaProgramada: agent.horaEntradaProgramada,
                    horaEntradaReal: officialLoginTime,
                    minutosRetardo: delayMinutos,
                    impactoLlamadas: impacto,
                    estatusAsistencia: estatusAsistencia,
                    tiempoLogueado: loggedTimeStr || '00:00:00'
                });
            }
        }

    } catch (err) {
        console.error('Core sync error:', err.message);
    }
}


module.exports = router;
