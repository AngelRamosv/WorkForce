const axios = require('axios');

async function deepExplore() {
    console.log('--- EXPLORACIÓN PROFUNDA DE CICIPULS ---');
    const baseUrl = 'http://192.168.48.183:8050';
    const paths = ['/data', '/stats', '/info', '/metrics', '/'];

    for (const path of paths) {
        console.log(`\nProbando ruta: ${baseUrl}${path}`);
        try {
            const res = await axios.get(`${baseUrl}${path}`, { timeout: 3000 });
            console.log(`[EXITO] - Tipo de contenido: ${res.headers['content-type']}`);
            
            if (path === '/data') {
                const data = res.data;
                console.log('Analizando campos desconocidos en /data...');
                // Buscar cualquier valor que parezca una fecha o un número grande (segundos)
                if (data.nombres && Array.isArray(data.nombres)) {
                    const sample = 5;
                    for (let i = 0; i < Math.min(sample, data.nombres.length); i++) {
                        console.log(`\nAgente: ${data.nombres[i]}`);
                        Object.keys(data).forEach(key => {
                            if (Array.isArray(data[key]) && data[key].length === data.nombres.length) {
                                const val = data[key][i];
                                // Intentar detectar si el valor es un timestamp o duración larga
                                console.log(`   - ${key}: ${val}`);
                                if (typeof val === 'number' && val > 1000) {
                                    console.log(`     >> POSIBLE DURACIÓN O TIMESTAMP detectado en [${key}]`);
                                }
                            }
                        });
                    }
                }
            } else if (typeof res.data === 'object') {
                console.log('Contenido encontrado:', Object.keys(res.data));
            } else {
                console.log('Respuesta (primeros 100 chars):', String(res.data).substring(0, 100));
            }
        } catch (e) {
            console.log(`[FALLO] - ${e.message}`);
        }
    }
}

deepExplore();
