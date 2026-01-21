'use client'

/**
 * Content Moderation Module
 * 
 * This module provides client-side content moderation to filter out
 * inappropriate content (nudity, explicit content, violence, etc.) before uploading.
 * 
 * Uses a combination of:
 * 1. Basic file validation
 * 2. Image analysis via Canvas (skin detection + violence patterns)
 * 3. Video validation (basic checks)
 */

// Skin color detection thresholds
const SKIN_TONE_RANGES = [
    { r: [95, 255], g: [40, 170], b: [20, 120] },  // Light skin
    { r: [50, 130], g: [30, 80], b: [15, 60] },    // Dark skin
    { r: [140, 255], g: [90, 180], b: [60, 140] }, // Medium skin
]

export interface ModerationResult {
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
            // For non-image files (videos), do basic validation
            resolve({ isAppropriate: true, confidence: 0.5, reason: 'Los videos requieren revisión manual' })
            return
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                try {
                    const result = performAdvancedAnalysis(img)
                    resolve(result)
                } catch (error) {
                    console.error('Error analyzing image:', error)
                    // On error, allow with low confidence
                    resolve({ isAppropriate: true, confidence: 0.3, reason: 'Error de análisis, revisión manual necesaria' })
                }
            }
            img.onerror = () => {
                resolve({ isAppropriate: true, confidence: 0.3, reason: 'No se pudo cargar la imagen' })
            }
            img.src = e.target?.result as string
        }
        reader.onerror = () => {
            resolve({ isAppropriate: true, confidence: 0.3, reason: 'No se pudo leer el archivo' })
        }
        reader.readAsDataURL(file)
    })
}

/**
 * Validates video content with basic checks
 */
export async function analyzeVideoContent(file: File): Promise<ModerationResult> {
    return new Promise((resolve) => {
        // Basic video validation
        if (!file.type.startsWith('video/')) {
            resolve({ isAppropriate: false, confidence: 0.9, reason: 'Formato de video no válido' })
            return
        }

        // Check file size (max 50MB for videos)
        const maxVideoSize = 50 * 1024 * 1024
        if (file.size > maxVideoSize) {
            resolve({ isAppropriate: false, confidence: 0.9, reason: 'Video muy grande. Máximo 50MB' })
            return
        }

        // For now, videos pass basic check - production should use Cloud Vision API
        // Videos will be flagged for manual review if needed
        resolve({
            isAppropriate: true,
            confidence: 0.6,
            reason: undefined
        })
    })
}

/**
 * Advanced analysis combining skin detection and violence pattern detection
 */
function performAdvancedAnalysis(img: HTMLImageElement): ModerationResult {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        return { isAppropriate: true, confidence: 0.3, reason: 'Canvas no soportado' }
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
    let redPixels = 0
    let darkPixels = 0

    // Count different pixel types
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        // Check for skin tones
        if (isSkinTone(r, g, b)) {
            skinPixels++
        }

        // Check for blood/violence patterns (high red, low green/blue)
        if (r > 150 && r > g * 1.5 && r > b * 1.5 && g < 100 && b < 100) {
            redPixels++
        }

        // Check for very dark pixels (potential violent imagery)
        if (r < 30 && g < 30 && b < 30) {
            darkPixels++
        }
    }

    const skinPercentage = skinPixels / totalPixels
    const redPercentage = redPixels / totalPixels
    const darkPercentage = darkPixels / totalPixels

    // Check for potentially violent content (high blood-red areas)
    if (redPercentage > 0.25) {
        return {
            isAppropriate: false,
            confidence: 0.7,
            reason: 'Contenido potencialmente violento detectado. Por favor, sube otra imagen.'
        }
    }

    // STRICT threshold for skin - 45% to catch more cases
    if (skinPercentage > 0.45) {
        return {
            isAppropriate: false,
            confidence: 0.75,
            reason: 'Contenido no apropiado para eventos familiares. Por favor, sube una foto diferente.'
        }
    }

    // Check for suspicious combination: moderate skin + low variance
    if (skinPercentage > 0.35 && hasLowVariance(data)) {
        return {
            isAppropriate: false,
            confidence: 0.65,
            reason: 'Esta imagen no parece ser de un evento. Por favor, sube fotos del evento.'
        }
    }

    // Check for mostly dark images (potential inappropriate content)
    if (darkPercentage > 0.6 && skinPercentage > 0.2) {
        return {
            isAppropriate: false,
            confidence: 0.6,
            reason: 'Imagen demasiado oscura o inapropiada. Por favor, sube una foto más clara.'
        }
    }

    return {
        isAppropriate: true,
        confidence: 0.85,
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
    const maxImageSize = 20 * 1024 * 1024 // 20MB for images
    const maxVideoSize = 50 * 1024 * 1024 // 50MB for videos
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mov']

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
        return { valid: false, error: 'Solo se permiten fotos y videos.' }
    }

    if (isImage && file.size > maxImageSize) {
        return { valid: false, error: 'La imagen es muy grande. Máximo 20MB.' }
    }

    if (isVideo && file.size > maxVideoSize) {
        return { valid: false, error: 'El video es muy grande. Máximo 50MB.' }
    }

    // Check specific allowed types
    const isAllowedImage = allowedImageTypes.some(type => file.type === type || file.type.startsWith('image/'))
    const isAllowedVideo = allowedVideoTypes.some(type => file.type === type || file.type.startsWith('video/'))

    if (isImage && !isAllowedImage) {
        return { valid: false, error: 'Formato de imagen no soportado. Usa JPG, PNG, GIF o WebP.' }
    }

    if (isVideo && !isAllowedVideo) {
        return { valid: false, error: 'Formato de video no soportado. Usa MP4, MOV o WebM.' }
    }

    return { valid: true }
}

