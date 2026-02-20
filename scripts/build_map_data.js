const fs = require('fs');
const xlsx = require('xlsx');

function parseKML() {
    try {
        const kmlText = fs.readFileSync('C:/Users/ENRIQ/soynexo-web/registros/kml/doc.kml', 'utf-8');

        const wb = xlsx.readFile('C:/Users/ENRIQ/soynexo-web/registros/Archivo de Metas.xlsx');
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const targets = xlsx.utils.sheet_to_json(sheet);

        // Very basic coordinate extractor since full XML parsing isn't strictly necessary for Point placemarks
        // Note: Real polygons have <Polygon><outerBoundaryIs><LinearRing><coordinates>...
        // Let's check if the KML actually has polygons or just points.

        let out = { targets, kml: kmlText }
        fs.writeFileSync('C:/Users/ENRIQ/soynexo-web/public/map_data.json', JSON.stringify(out));
        console.log("Success: wrote map_data.json");
    } catch (err) {
        console.error("Error:", err);
    }
}
parseKML();
