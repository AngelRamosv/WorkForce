const xlsx = require('xlsx');
const path = require('path');

try {
    const filePath = path.join(__dirname, 'STAFF 19 febrero act.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log('--- VISTA PREVIA DEL ARCHIVO STAFF ---');
    console.log(`Total de filas detectadas: ${data.length}`);
    console.log('Primeras 5 filas:');
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
} catch (e) {
    console.error('Error al leer el archivo:', e.message);
}
