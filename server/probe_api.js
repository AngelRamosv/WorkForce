const axios = require('axios');
async function probe() {
    try {
        const res = await axios.get('http://192.168.48.183:8050/data', { timeout: 5000 });
        console.log('---DATA_START---');
        console.log(JSON.stringify(res.data, null, 2));
        console.log('---DATA_END---');
    } catch (e) {
        console.error('PROBE_FAILED:', e.message);
    }
}
probe();
