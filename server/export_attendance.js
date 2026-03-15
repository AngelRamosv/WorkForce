const Attendance = require('./src/models/Attendance');
const Agent = require('./src/models/Agent');
const Config = require('./src/models/Config');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

async function exportAttendance() {
    let externalConn;
    try {
        console.log('🚀 Iniciando proceso de exportación...');
        
        // 1. Migrar datos faltantes (10-11 de marzo)
        externalConn = await mysql.createConnection({
            host: '192.168.50.33',
            user: 'cyberhub',
            password: 'masterC1berHUb#',
            database: 'cyber_ideas_hub'
        });

        console.log('📥 Sincronizando datos de los días 10 y 11 de marzo...');
        
        const [rows] = await externalConn.execute(`
            SELECT a.personal_id, a.fecha_asistencia, MIN(a.created_at) as first_login, p.personal_nombre 
            FROM asistencias a 
            JOIN personal p ON a.personal_id = p.personal_id 
            JOIN estatus_asistencias e ON a.estatus_asistencias_id = e.estatus_asistencias_id
            WHERE a.fecha_asistencia BETWEEN '2026-03-10' AND '2026-03-11'
            AND e.descripcion IN ('Asistencia normal', 'Asistencia dia festivo', 'Retardo', 'Capacitación')
            GROUP BY a.personal_id, a.fecha_asistencia
        `);

        const agents = await Agent.findAll();
        const config = await Config.findOne();
        const tolerance = config?.lateToleranceMinutes || 5;
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
                const actualTime = loginDate.toLocaleTimeString('es-MX', { hour12: false, hour: '2-digit', minute: '2-digit' });

                const [sH, sM] = localAgent.scheduledStartTime.split(':').map(Number);
                const [nH, nM] = actualTime.split(':').map(Number);
                
                const scheduledMinutes = sH * 60 + sM;
                const actualMinutes = nH * 60 + nM;
                const delay = actualMinutes - scheduledMinutes;
                const status = delay > tolerance ? 'Late' : 'OnTime';

                await Attendance.upsert({
                    agentName: localAgent.name,
                    date: dateStr,
                    scheduledStartTime: localAgent.scheduledStartTime,
                    actualLoginTime: actualTime,
                    delayMinutes: Math.max(0, delay),
                    status,
                    poolId: localAgent.poolId
                });
            }
        }

        // 2. Exportar todos los datos del 1 al 11 de marzo
        console.log('📊 Generando reporte Excel...');
        const allAttendance = await Attendance.findAll({
            where: {
                date: '2026-03-12'
            },
            order: [['agentName', 'ASC']]
        });

        const data = allAttendance.map(a => ({
            'Fecha': a.date,
            'Agente': a.agentName,
            'Horario Programado': a.scheduledStartTime,
            'Hora Entrada Real': a.actualLoginTime,
            'Retardo (min)': a.delayMinutes,
            'Impacto (Llamadas)': Math.round(a.delayMinutes / 11.5),
            'Estatus': a.status === 'Late' ? 'RETARDO' : 'A TIEMPO'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Retardos Hoy 12 Marzo");

        const fileName = `Reporte_Retardos_Hoy_12_Marzo.xlsx`;
        const filePath = path.join(process.cwd(), fileName);
        XLSX.writeFile(wb, filePath);

        console.log(`✅ Reporte generado exitosamente: ${filePath}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (externalConn) await externalConn.end();
        process.exit();
    }
}

exportAttendance();
