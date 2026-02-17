
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

console.log('Canvas loaded successfully');
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');
ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 200, 200);
console.log('Canvas operations working');
