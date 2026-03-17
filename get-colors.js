const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

async function getColors() {
    try {
        const img = await loadImage('./public/social/PATTY50.png');
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Get top-left pixel
        const tl = ctx.getImageData(0, 0, 1, 1).data;
        // Get top-right pixel
        const tr = ctx.getImageData(img.width - 1, 0, 1, 1).data;
        // Get center pixel
        const cx = ctx.getImageData(img.width / 2, img.height / 2, 1, 1).data;
        // get average color of the image

        console.log(`Top-Left: rgba(${tl[0]}, ${tl[1]}, ${tl[2]}, ${tl[3]})`);
        console.log(`Top-Right: rgba(${tr[0]}, ${tr[1]}, ${tr[2]}, ${tr[3]})`);
        console.log(`Center: rgba(${cx[0]}, ${cx[1]}, ${cx[2]}, ${cx[3]})`);

    } catch (e) {
        console.error(e);
    }
}
getColors();
