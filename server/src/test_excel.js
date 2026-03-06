const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../../STAFF 26 FEBRERO ACT.xlsx');

try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    let movilCount = 0;
    let retencionCount = 0;

    data.forEach(row => {
        const rowStr = JSON.stringify(row).toLowerCase();
        if (rowStr.includes('movil') || rowStr.includes('móvil')) {
            movilCount++;
        } else {
            retencionCount++;
        }
    });

    console.log(`Análisis del archivo STAFF 26 FEBRERO ACT.xlsx:`);
    console.log(`Total de registros: ${data.length}`);
    console.log(`- Móvil: ${movilCount}`);
    console.log(`- Retención: ${retencionCount}`);

} catch (error) {
    console.error('Error al leer el archivo:', error.message);
}
