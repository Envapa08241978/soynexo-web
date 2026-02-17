import { initializeApp } from 'firebase/app';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';
import https from 'https';
import fs from 'fs';
import path from 'path';

const firebaseConfig = {
    apiKey: "AIzaSyBOkHtoVXQ12K7P7FYNTB0nvAQW6bAKiTw",
    authDomain: "soy-nexo.firebaseapp.com",
    projectId: "soy-nexo",
    storageBucket: "soy-nexo.firebasestorage.app",
    messagingSenderId: "297456603993",
    appId: "1:297456603993:web:0f64d149f8ebef16b6f248"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
            }
        }).on('error', reject);
    });
}

async function main() {
    console.log('📂 Listando archivos en gs://soy-nexo.firebasestorage.app/events...\n');

    try {
        const eventsRef = ref(storage, 'events');
        const result = await listAll(eventsRef);

        console.log(`📁 Carpetas encontradas: ${result.prefixes.length}`);
        result.prefixes.forEach(p => console.log('  📁', p.fullPath));

        console.log(`\n📄 Archivos directos: ${result.items.length}`);
        result.items.forEach(i => console.log('  📄', i.fullPath));

        // List first subfolder contents
        if (result.prefixes.length > 0) {
            for (let i = 0; i < Math.min(result.prefixes.length, 3); i++) {
                const subRef = result.prefixes[i];
                console.log(`\n📂 Contenido de ${subRef.fullPath}:`);
                const subResult = await listAll(subRef);

                subResult.prefixes.forEach(p => console.log('  📁', p.fullPath));

                const files = subResult.items.slice(0, 5);
                for (const item of files) {
                    const url = await getDownloadURL(item);
                    console.log(`  📄 ${item.name} → ${url.substring(0, 80)}...`);
                }
                console.log(`  (${subResult.items.length} archivos total)`);
            }
        }

        // Download first 3 photos from the first event folder that has photos
        const outputDir = path.join(process.cwd(), 'public', 'social');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        for (const prefix of result.prefixes) {
            const subResult = await listAll(prefix);
            if (subResult.items.length > 0) {
                console.log(`\n⬇️ Descargando fotos de ${prefix.fullPath}...`);
                const toDownload = subResult.items.slice(0, 3);
                for (let i = 0; i < toDownload.length; i++) {
                    const item = toDownload[i];
                    const url = await getDownloadURL(item);
                    const ext = item.name.split('.').pop() || 'jpg';
                    const localPath = path.join(outputDir, `event_photo_${i + 1}.${ext}`);
                    console.log(`  ⬇️ Descargando ${item.name}...`);
                    await downloadFile(url, localPath);
                    console.log(`  ✅ Guardado: ${localPath}`);
                }
                break;
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.code || error.message);
    }

    process.exit(0);
}

main();
