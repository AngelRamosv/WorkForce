const mysql = require('mysql2/promise');

async function checkExternalDB() {
    console.log('--- CONSULTANDO BASE DE DATOS EXTERNA (CyberIdeas Hub) ---');
    try {
        const connection = await mysql.createConnection({
            host: '192.168.50.33',
            user: 'cyberhub',
            password: 'masterC1berHUb#',
            database: 'cyber_ideas_hub'
        });

        const today = new Date().toISOString().split('T')[0];
        console.log(`Buscando asistencias para hoy: ${today}`);

        const [rows] = await connection.execute(`
            SELECT a.personal_id, MIN(a.created_at) as first_login, p.personal_nombre 
            FROM asistencias a 
            JOIN personal p ON a.personal_id = p.personal_id 
            WHERE a.fecha_asistencia = ?
            GROUP BY a.personal_id
            LIMIT 10
        `, [today]);

        if (rows.length > 0) {
            console.log('\n[EXITO] Datos encontrados para hoy:');
            rows.forEach(r => {
                console.log(`- ${r.personal_nombre}: Login a las ${r.first_login}`);
            });
        } else {
            console.log('\n[AVISO] No hay datos registrados para hoy todavía en esta tabla.');
            
            // Ver si hay de ayer para confirmar que la tabla se usa
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yDate = yesterday.toISOString().split('T')[0];
            console.log(`Buscando asistencias para ayer: ${yDate}`);
            
            const [yRows] = await connection.execute(`
                SELECT COUNT(*) as total FROM asistencias WHERE fecha_asistencia = ?
            `, [yDate]);
            console.log(`Total registros ayer: ${yRows[0].total}`);
        }

        await connection.end();
    } catch (e) {
        console.error('\n[ERROR] No se pudo conectar a la DB externa:');
        console.error(e.message);
    }
}

checkExternalDB();
