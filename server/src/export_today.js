const sequelize = require('./database');
const xlsx = require('xlsx');
const path = require('path');

async function exportReport() {
    try {
        console.log('Generando reporte Excel...');
        const [rows] = await sequelize.query(`
            SELECT 
                fecha AS "Fecha", 
                nombreAgente AS "Agente", 
                horaEntradaProgramada AS "Horario Programado", 
                minutosRetardo AS "Minutos Retardo", 
                impactoLlamadas AS "Impacto (Llamadas)", 
                estatusAsistencia AS "Estatus" 
            FROM asistencias 
            WHERE fecha = CURDATE() 
            ORDER BY minutosRetardo DESC
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
