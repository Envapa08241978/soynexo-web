const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Configuration
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SOCIAL_DIR = path.join(PUBLIC_DIR, 'social');
const OUTPUT_Files = {
    ig: path.join(PUBLIC_DIR, 'SoyNexo_IG_Feb16_Educational.png'),
    tiktok: path.join(PUBLIC_DIR, 'SoyNexo_TikTok_Feb16_Cover.png'),
    gmb: path.join(PUBLIC_DIR, 'SoyNexo_GMB_Feb16_Update.png')
};

// Colors
const COLORS = {
    brand: '#a855f7', // Purple
    accent: '#0ea5e9', // Blue
    white: '#ffffff',
    gray: '#cccccc',
    dark: '#050505'
};

async function generateImages() {
    console.log('Starting image generation...');

    // Load common assets
    const logoPath = path.join(PUBLIC_DIR, 'logo.png');
    const photo1Path = path.join(SOCIAL_DIR, 'event_photo_1.jpg'); // Atmosphere/Aloes
    const photo2Path = path.join(SOCIAL_DIR, 'event_photo_2.jpg'); // R70
    const photo3Path = path.join(SOCIAL_DIR, 'event_photo_3.jpg'); // Person/Fun

    try {
        const logo = await loadImage(logoPath);
        const photo1 = await loadImage(photo1Path);
        const photo2 = await loadImage(photo2Path);
        const photo3 = await loadImage(photo3Path);

        // --- 1. IG POST (Square) ---
        await generateIGPost(photo2, logo);

        // --- 2. TIKTOK COVER (Vertical) ---
        await generateTikTokCover(photo3, logo);

        // --- 3. GMB POST (Horizontal) ---
        await generateGMBPost(photo1, logo);

        console.log('All images generated successfully!');

    } catch (error) {
        console.error('Error generating images:', error);
    }
}

async function generateIGPost(bgImage, logo) {
    const width = 1080;
    const height = 1080;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    drawBackground(ctx, bgImage, width, height, 0.5);

    // Gradient Overlay (Radial)
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
    gradient.addColorStop(0, 'rgba(30, 27, 75, 0.4)'); // Indigo
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

    // Content
    // Badge
    ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
    drawRoundRect(ctx, width / 2 - 100, 80, 200, 50, 25);
    ctx.fill();
    ctx.fillStyle = COLORS.brand;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('EDUCATIVO', width / 2, 115);

    // Logo
    const logoW = 150;
    const logoH = (logo.height / logo.width) * logoW;
    ctx.drawImage(logo, width / 2 - logoW / 2, 160, logoW, logoH);

    // Title
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 100px Arial';
    ctx.fillText('3 RAZONES', width / 2, 350);
    ctx.font = '30px Arial';
    ctx.fillStyle = COLORS.gray;
    ctx.fillText('para usar un álbum digital', width / 2, 400);

    // Divider
    ctx.fillStyle = COLORS.brand;
    ctx.fillRect(width / 2 - 50, 430, 100, 4);

    // List
    ctx.textAlign = 'left';
    const startX = 200;
    const startY = 550;
    const items = [
        { title: 'Fotos en Alta Calidad', subtitle: 'Sin compresión de WhatsApp' },
        { title: 'Todo en un solo lugar', subtitle: 'No más perseguir invitados' },
        { title: 'Descarga Instantánea', subtitle: 'Obtén el álbum completo' }
    ];

    items.forEach((item, i) => {
        const y = startY + (i * 120);
        // Icon placeholder
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(startX - 80, y - 40, 60, 60);

        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 36px Arial';
        ctx.fillText(item.title, startX, y);

        ctx.fillStyle = COLORS.gray;
        ctx.font = '24px Arial';
        ctx.fillText(item.subtitle, startX, y + 35);
    });

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('www.soynexo.com   |   @soynexo', width / 2, height - 50);

    saveCanvas(canvas, OUTPUT_Files.ig);
}

async function generateTikTokCover(bgImage, logo) {
    const width = 1080;
    const height = 1920;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    drawBackground(ctx, bgImage, width, height, 0.6); // Darker

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0,0,0,0.4)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Content centered
    ctx.textAlign = 'center';

    // Logo
    const logoW = 250;
    const logoH = (logo.height / logo.width) * logoW;
    ctx.drawImage(logo, width / 2 - logoW / 2, 300, logoW, logoH);

    // Hook Text
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 80px Arial';
    ctx.fillText('ASÍ DE FÁCIL', width / 2, 600);
    ctx.fillStyle = COLORS.brand;
    ctx.fillText('FUNCIONA', width / 2, 700);

    // Steps
    const steps = ['1. Escanea', '2. Sube', '3. Disfruta'];
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = COLORS.white;
    let y = 900;
    steps.forEach(step => {
        ctx.fillText(step, width / 2, y);
        y += 120;
    });

    // Valid only for today
    ctx.fillStyle = COLORS.accent;
    ctx.font = '40px Arial';
    ctx.fillText('Sin descargar Apps', width / 2, y + 50);

    saveCanvas(canvas, OUTPUT_Files.tiktok);
}

async function generateGMBPost(bgImage, logo) {
    const width = 1200;
    const height = 900;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    drawBackground(ctx, bgImage, width, height, 0.4);

    // Side Gradient (Left to Right)
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(5, 5, 10, 0.95)');
    gradient.addColorStop(0.6, 'rgba(5, 5, 10, 0.8)');
    gradient.addColorStop(1, 'rgba(5, 5, 10, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Content Left Aligned
    ctx.textAlign = 'left';
    let x = 100;
    let y = 200;

    // Logo small
    const logoW = 100;
    const logoH = (logo.height / logo.width) * logoW;
    ctx.drawImage(logo, x, 100, logoW, logoH);

    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 40px Arial';
    ctx.fillText('Soy Nexo', x + 120, 160);

    // Headline
    y = 350;
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = COLORS.white;
    ctx.fillText('Tu Álbum Digital', x, y);
    ctx.fillText('para Eventos', x, y + 90);

    // Features
    y = 550;
    ctx.font = '36px Arial';
    ctx.fillStyle = COLORS.gray;
    ctx.fillText('✓ Sin descargar aplicaciones', x, y);
    ctx.fillText('✓ Fotos en tiempo real', x, y + 60);
    ctx.fillText('✓ Descarga completa al final', x, y + 120);

    // Footer
    ctx.font = '24px Arial';
    ctx.fillStyle = COLORS.brand;
    ctx.fillText('www.soynexo.com  📍 Navojoa, Son.', x, height - 50);

    saveCanvas(canvas, OUTPUT_Files.gmb);
}

function drawBackground(ctx, img, width, height, opacity) {
    // Cover fit
    const scale = Math.max(width / img.width, height / img.height);
    const x = (width / 2) - (img.width / 2) * scale;
    const y = (height / 2) - (img.height / 2) * scale;

    ctx.globalAlpha = opacity;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    ctx.globalAlpha = 1.0;
}

function saveCanvas(canvas, filepath) {
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
    console.log(`Saved: ${filepath}`);
}

// Helper for rounded rect
function drawRoundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    return ctx;
}

generateImages();
