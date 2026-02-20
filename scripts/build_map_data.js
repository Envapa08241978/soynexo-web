const fs = require('fs');

function parseKML() {
    try {
        const kmlText = fs.readFileSync('C:/Users/ENRIQ/soynexo-web/registros/kml/sonora.kml', 'utf-8');

        // Extract polygons from the KML
        const pointMap = {};
        const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
        let pMatch;

        while ((pMatch = placemarkRegex.exec(kmlText)) !== null) {
            const block = pMatch[1];
            // Extract sector number from CDATA description
            const descMatch = block.match(/control:\s*(\d+)/);
            if (!descMatch) continue;
            const sectorName = String(descMatch[1]).trim();

            // Extract polygon coordinates
            const polyMatch = block.match(/<Polygon>[\s\S]*?<coordinates>\s*([\s\S]*?)\s*<\/coordinates>[\s\S]*?<\/Polygon>/);
            if (polyMatch) {
                // Parse coordinates "lng,lat,alt lng,lat,alt ..." into array of objects {lat, lng}
                const coordsRaw = polyMatch[1].trim().split(/\s+/);
                const geometry = coordsRaw.map(pair => {
                    const parts = pair.split(',');
                    return { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
                }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

                if (geometry.length > 0) {
                    pointMap[sectorName] = geometry;
                }
            }
        }

        // We use the already cleaned JSON of Navojoa
        const rawData = fs.readFileSync('C:/Users/ENRIQ/soynexo-web/public/map_data_fixed.json', 'utf8');
        const parsedData = JSON.parse(rawData).targets;

        let polygonCount = 0;
        const targets = parsedData.map(row => {
            const sectorStr = String(row['Sector Comunitario']).trim();
            if (pointMap[sectorStr]) {
                row.geometry = pointMap[sectorStr];
                polygonCount++;
            } else {
                row.geometry = [];
            }
            return row;
        });

        const out = { targets };
        fs.writeFileSync('C:/Users/ENRIQ/soynexo-web/public/map_data.json', JSON.stringify(out));
        console.log(`Success: wrote map_data.json with ${targets.length} targets. Mapped ${polygonCount} true Polygons!`);
    } catch (err) {
        console.error("Error:", err);
    }
}
parseKML();
