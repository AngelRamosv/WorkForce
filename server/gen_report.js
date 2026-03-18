const sequelize = require('./src/database');
const xlsx = require('xlsx');
const path = require('path');

async function doExport() {
    try {
        const [rows] = await sequelize.query("SELECT agentName, scheduledStartTime, actualLoginTime, delayMinutes, status FROM attendances WHERE date = '2026-03-15'");
        
        const filtered = rows.filter(r => {
            if (!r.actualLoginTime) return false;
            const parts = r.actualLoginTime.split(':');
            if (parts.length < 2) return false;
            const h = parseInt(parts[0]);
            const m = parseInt(parts[1]);
            const timeVal = h * 60 + m;
            // 9:00 AM (540 min) a 4:00 PM (960 min)
            return timeVal >= 540 && timeVal <= 960;
        });

        const data = filtered.map(a => ({
            'Agente': a.agentName,
            'Horario Programado': a.scheduledStartTime,
            'Hora Entrada Real': a.actualLoginTime,
            'Retardo (min)': a.delayMinutes,
            'Impacto (Llamadas)': Math.round(a.delayMinutes / 11.5),
            'Estatus': a.status === 'Late' ? 'RETARDO' : 'A TIEMPO'
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Asistencia');
        
        const outputPath = path.join(__dirname, 'Reporte_Retardos_Hoy.xlsx');
        xlsx.writeFile(wb, outputPath);
        
        console.log(`SUCCESS: Generated report with ${filtered.length} records at ${outputPath}`);
    } catch (e) {
        console.error(`FAIL: ${e.message}`);
        process.exit(1);
    } finally {
        // Ensure process exits after async operation
        process.exit(0);
    }
}

doExport();
