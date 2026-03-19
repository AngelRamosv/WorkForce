const sequelize = require('./database');
const xlsx = require('xlsx');
const path = require('path');

async function exportReport() {
    try {
        console.log('Generando reporte Excel...');
        const [rows] = await sequelize.query(`
            SELECT 
                a.fecha AS "Fecha", 
                a.nombreAgente AS "Agente", 
                a.horaEntradaProgramada AS "Horario Programado", 
                a.minutosRetardo AS "Minutos Retardo", 
                a.impactoLlamadas AS "Impacto (Llamadas)", 
                a.estatusAsistencia AS "Estatus" 
            FROM asistencias a
            JOIN agentes ag ON a.nombreAgente = ag.nombre
            WHERE a.fecha = CURDATE() 
              AND ag.turno != 'Nocturno'
              AND a.minutosRetardo > 0
            ORDER BY a.minutosRetardo DESC
        `);

        if (rows.length === 0) {
            console.log('No hay registros encontrados para hoy en la base de datos.');
            process.exit(0);
        }

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(rows);
        xlsx.utils.book_append_sheet(wb, ws, 'Retardos Hoy');
        
        // Guardar en el escritorio del usuario
        const desktopPath = path.join('C:', 'Users', 'Desarrollo', 'Desktop', 'Reporte_Retardos_18_Marzo.xlsx');
        xlsx.writeFile(wb, desktopPath);
        
        console.log('ÉXITO: Reporte generado en ' + desktopPath + ' con ' + rows.length + ' registros.');
        process.exit(0);
    } catch (e) {
        console.error('Error al exportar:', e.message);
        process.exit(1);
    }
}

exportReport();
