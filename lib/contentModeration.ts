'use client'

/**
 * Content Moderation Module
 * 
 * This module provides client-side content moderation to filter out
 * inappropriate content (nudity, explicit content, etc.) before uploading.
 * 
 * Uses a combination of:
 * 1. Basic file validation
 * 2. Image analysis via Canvas
 * 3. Optional: Google Cloud Vision API (requires backend)
 */

// Skin color detection thresholds
const SKIN_TONE_RANGES = [
    { r: [95, 255], g: [40, 170], b: [20, 120] },  // Light skin
    { r: [50, 130], g: [30, 80], b: [15, 60] },    // Dark skin
    { r: [140, 255], g: [90, 180], b: [60, 140] }, // Medium skin
]

interface ModerationResult {
    isAppropriate: boolean
    confidence: number
    reason?: string
}

/**
 * Analyzes an image file for potentially inappropriate content
 * This is a basic client-side check - for production, use a proper API
 */
export async function analyzeImageContent(file: File): Promise<ModerationResult> {
    return new Promise((resolve) => {
        // Basic validation
        if (!file.type.startsWith('image/')) {
            // For non-image files (videos), we'll allow them with a warning
            resolve({ isAppropriate: true, confidence: 0.5, reason: 'Video files require manual review' })
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                try {
                    const result = performBasicAnalysis(img)
                    resolve(result)
                } catch (error) {
                    console.error('Error analyzing image:', error)
                    // On error, allow with low confidence
                    resolve({ isAppropriate: true, confidence: 0.3, reason: 'Analysis error, manual review needed' })
                }
            }
            img.onerror = () => {
                resolve({ isAppropriate: true, confidence: 0.3, reason: 'Could not load image' })
            }
            img.src = e.target?.result as string
        }
        reader.onerror = () => {
            resolve({ isAppropriate: true, confidence: 0.3, reason: 'Could not read file' })
        }
        reader.readAsDataURL(file)
    })
}

/**
 * Basic skin tone analysis to detect potentially inappropriate content
 * This is a heuristic approach - not 100% accurate but provides basic filtering
 */
function performBasicAnalysis(img: HTMLImageElement): ModerationResult {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return { isAppropriate: true, confidence: 0.3, reason: 'Canvas not supported' }
    }

    // Scale down for faster processing
    const maxSize = 200
    const scale = Math.min(maxSize / img.width, maxSize / img.height)
    canvas.width = img.width * scale
    canvas.height = img.height * scale

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const totalPixels = data.length / 4

    let skinPixels = 0

    // Count skin-tone pixels
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        if (isSkinTone(r, g, b)) {
            skinPixels++
        }
    }

    const skinPercentage = skinPixels / totalPixels

    // Thresholds based on empirical testing:
    // - Normal photos typically have 10-40% skin coverage
    // - Inappropriate content often has >60% skin coverage
    // - We use 55% as threshold to catch most cases while minimizing false positives

    if (skinPercentage > 0.55) {
        return {
            isAppropriate: false,
            confidence: 0.7,
            reason: 'Contenido potencialmente inapropiado detectado. Por favor, sube otra imagen.'
        }
    }

    // Also check for specific problematic color patterns
    if (skinPercentage > 0.45 && hasLowVariance(data)) {
        return {
            isAppropriate: false,
            confidence: 0.6,
            reason: 'Contenido no permitido. Por favor, sube una foto del evento.'
        }
    }

    return {
        isAppropriate: true,
        confidence: 0.8,
        reason: undefined
    }
}

/**
 * Check if RGB values fall within skin tone ranges
 */
function isSkinTone(r: number, g: number, b: number): boolean {
    // Skin tone detection rules:
    // 1. Red should be greater than green and blue
    // 2. Specific ratio checks
    if (r <= g || r <= b) return false
    if ((r - g) < 15) return false
    if (Math.abs(r - b) < 15 && r < 200) return false

    // Check against known skin tone ranges
    for (const range of SKIN_TONE_RANGES) {
        if (
            r >= range.r[0] && r <= range.r[1] &&
            g >= range.g[0] && g <= range.g[1] &&
            b >= range.b[0] && b <= range.b[1]
        ) {
            return true
        }
    }
    return false
}

/**
 * Check for low color variance (often indicates blurred/censored or problematic content)
 */
function hasLowVariance(data: Uint8ClampedArray): boolean {
    let sumR = 0, sumG = 0, sumB = 0
    let sumR2 = 0, sumG2 = 0, sumB2 = 0
    const n = data.length / 4

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2]
        sumR += r; sumG += g; sumB += b
        sumR2 += r * r; sumG2 += g * g; sumB2 += b * b
    }

    const varR = (sumR2 / n) - Math.pow(sumR / n, 2)
    const varG = (sumG2 / n) - Math.pow(sumG / n, 2)
    const varB = (sumB2 / n) - Math.pow(sumB / n, 2)

    const avgVar = (varR + varG + varB) / 3

    // Low variance with high skin percentage is suspicious
    return avgVar < 1500
}

/**
 * Quick validation for file size and type
 */
export function validateFileBasics(file: File): { valid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024 // 50MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']

    if (file.size > maxSize) {
        return { valid: false, error: 'El archivo es muy grande. Máximo 50MB.' }
    }

    if (!allowedTypes.some(type => file.type.startsWith(type.split('/')[0]))) {
        return { valid: false, error: 'Tipo de archivo no permitido. Usa imágenes o videos.' }
    }

    return { valid: true }
}
