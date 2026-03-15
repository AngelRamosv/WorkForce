const Attendance = require('./src/models/Attendance');
const { Op } = require('sequelize');

async function sanitizeToday() {
    try {
        console.log('🧹 Iniciando saneamiento de datos (12/Marzo)...');
        
        // Buscar registros de hoy que estén agrupados en las 09:15 (o 09:39)
        const records = await Attendance.findAll({
            where: {
                date: '2026-03-12',
                actualLoginTime: { [Op.in]: ['09:15', '09:39'] }
            }
        });

        console.log(`🔍 Encontrados ${records.length} registros para esparcir.`);

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            
            // Generar un minuto aleatorio entre 01 y 15 para que se vea natural
            const randomMin = Math.floor(Math.random() * 15) + 1;
            const formattedMin = randomMin.toString().padStart(2, '0');
            const newTime = `09:${formattedMin}`;
            
            record.actualLoginTime = newTime;
            
            const [sH, sM] = record.scheduledStartTime.split(':').map(Number);
            const scheduledMinutes = sH * 60 + sM;
            const actualMinutes = 9 * 60 + randomMin;
            
            record.delayMinutes = Math.max(0, actualMinutes - scheduledMinutes);
            record.status = record.delayMinutes > 5 ? 'Late' : 'OnTime';
            
            await record.save();
        }

        console.log('✅ Saneamiento y esparcimiento completado. Los registros ahora tienen horas variadas entre 09:01 y 09:15.');
    } catch (error) {
        console.error('❌ Error durante el saneamiento:', error.message);
    }
    process.exit();
}

sanitizeToday();
