const fs = require('fs');
const xlsx = require('xlsx');

function parseKML() {
    try {
        const kmlText = fs.readFileSync('C:/Users/ENRIQ/soynexo-web/registros/kml/doc.kml', 'utf-8');

        // Extract points from the KML
        const pointMap = {};
        const pointRegex = /<Placemark>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<coordinates>(.*?)<\/coordinates>[\s\S]*?<\/Placemark>/g;
        let m;
        while ((m = pointRegex.exec(kmlText)) !== null) {
            const name = m[1].replace(/[^0-9]/g, ''); // Extract numerical string SECTOR XYZ -> XYZ
            const coordsStr = m[2].trim().split(',');
            if (coordsStr.length >= 2) {
                const lng = parseFloat(coordsStr[0]);
                const lat = parseFloat(coordsStr[1]);
                pointMap[name] = [{ lat, lng }]; // Single coordinate as geometry array
            }
        }

        const wb = xlsx.readFile('C:/Users/ENRIQ/soynexo-web/registros/Archivo de Metas.xlsx');
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawTargets = xlsx.utils.sheet_to_json(sheet);

        const targets = rawTargets.map(row => {
            const cleanObj = {};
            // Clean up keys (remove newlines and trim)
            for (let key in row) {
                const cleanKey = key.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
                cleanObj[cleanKey] = row[key];
            }

            const sectorStr = String(cleanObj['Sector Comunitario'] || '').trim();
            if (pointMap[sectorStr]) {
                cleanObj.geometry = pointMap[sectorStr];
            } else {
                cleanObj.geometry = [];
            }
            return cleanObj;
        });

        let out = { targets }
        fs.writeFileSync('C:/Users/ENRIQ/soynexo-web/public/map_data.json', JSON.stringify(out));
        console.log("Success: wrote map_data.json with " + targets.length + " targets.");
    } catch (err) {
        console.error("Error:", err);
    }
}
parseKML();
