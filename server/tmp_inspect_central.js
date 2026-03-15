const axios = require('axios');

async function inspectCentral() {
    console.log('--- INICIO DE INSPECCIÓN PASIVA ---');
    console.log('Consultando IP: http://192.168.48.183:8050/data');
    
    try {
        const response = await axios.get('http://192.168.48.183:8050/data', { timeout: 5000 });
        const data = response.data;
        
        console.log('\n1. ESTRUCTURA DE DATOS ENCONTRADA:');
        console.log(Object.keys(data));
        
        console.log('\n2. BUSCANDO CAMPOS DE TIEMPO/LOGIN:');
        const searchKeywords = ['time', 'login', 'session', 'duration', 'connect', 'sec', 'min'];
        const foundFields = Object.keys(data).filter(key => 
            searchKeywords.some(kw => key.toLowerCase().includes(kw))
        );
        console.log('Campos relacionados detectados:', foundFields);

        if (data.nombres && Array.isArray(data.nombres)) {
            console.log(`\n3. MUESTRA DE DATOS (Agentes: ${data.nombres.length}):`);
            const sampleSize = 3;
            for (let i = 0; i < Math.min(sampleSize, data.nombres.length); i++) {
                console.log(`\nAgente [${i}]: ${data.nombres[i]}`);
                // Imprimir todos los valores asociados si existen arreglos paralelos
                Object.keys(data).forEach(key => {
                    if (Array.isArray(data[key]) && data[key].length === data.nombres.length) {
                        console.log(`   - ${key}: ${data[key][i]}`);
                    }
                });
            }
        }

        console.log('\n--- FIN DE INSPECCIÓN ---');
    } catch (error) {
        console.error('\nERROR DE CONEXIÓN:');
        console.error('Mensaje:', error.message);
        console.log('\nPosibles causas:');
        console.log('- No estás en la red local de la oficina.');
        console.log('- El firewall bloquea el puerto 8050.');
        console.log('- La central está apagada o reiniciándose.');
    }
}

inspectCentral();
