'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Matter from 'matter-js'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface Photo {
    id: string
    url: string
    timestamp: number
}

interface GravityWallProps {
    eventSlug: string
}

// Demo photo URLs - using reliable picsum.photos with fixed seeds
const DEMO_PHOTO_URLS = [
    'https://picsum.photos/seed/party1/400/300',
    'https://picsum.photos/seed/party2/400/300',
    'https://picsum.photos/seed/party3/400/300',
    'https://picsum.photos/seed/party4/400/300',
    'https://picsum.photos/seed/party5/400/300',
    'https://picsum.photos/seed/party6/400/300',
    'https://picsum.photos/seed/party7/400/300',
    'https://picsum.photos/seed/party8/400/300',
];

export default function GravityWall({ eventSlug }: GravityWallProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const engineRef = useRef<Matter.Engine | null>(null)
    const renderRef = useRef<Matter.Render | null>(null)
    const runnerRef = useRef<Matter.Runner | null>(null)
    const worldRef = useRef<Matter.World | null>(null)
    const photoBodiesRef = useRef<Map<string, Matter.Body>>(new Map())
    const loadedImagesRef = useRef<Map<string, string>>(new Map())
    const [isLoading, setIsLoading] = useState(true)
    const [photoCount, setPhotoCount] = useState(0)
    const [photoSize, setPhotoSize] = useState(100) // Scale from 50 to 150

    // Function to preload an image and convert to data URL
    const preloadImage = useCallback((url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (loadedImagesRef.current.has(url)) {
                resolve(loadedImagesRef.current.get(url)!);
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                try {
                    // Convert to canvas data URL for reliable rendering
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        loadedImagesRef.current.set(url, dataUrl);
                        resolve(dataUrl);
                    } else {
                        reject(new Error('Failed to get canvas context'));
                    }
                } catch (e) {
                    reject(e);
                }
            };

            img.onerror = () => {
                reject(new Error(`Failed to load image: ${url}`));
            };

            img.src = url;
        });
    }, []);

    // Function to create a photo body with image texture
    const createPhotoBody = useCallback((dataUrl: string, worldWidth: number) => {
        // Base size scaled by photoSize (50-150 becomes 0.5-1.5 multiplier)
        const sizeMultiplier = photoSize / 100;
        const baseWidth = 80 + Math.random() * 40; // Random width between 80-120
        const photoWidth = baseWidth * sizeMultiplier;
        const photoHeight = photoWidth * 0.75; // 4:3 aspect ratio

        // Random X position at the top
        const x = photoWidth / 2 + Math.random() * (worldWidth - photoWidth);
        const y = -photoHeight - 50; // Start above the viewport

        // Create the body
        const body = Matter.Bodies.rectangle(x, y, photoWidth, photoHeight, {
            restitution: 0.5, // Bounce
            friction: 0.6,
            frictionAir: 0.008,
            density: 0.001,
            angle: (Math.random() - 0.5) * 0.4, // Slight random rotation
            chamfer: { radius: 8 }, // Rounded corners
            render: {
                sprite: {
                    texture: dataUrl,
                    xScale: photoWidth / 400,
                    yScale: photoHeight / 300,
                }
            }
        });

        // Add slight initial rotation velocity for more natural falling
        Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.03);

        return body;
    }, [photoSize]);

    // Function to add a new photo to the world
    const addPhoto = useCallback(async (photo: Photo) => {
        if (!worldRef.current || !canvasRef.current) return;

        // Don't add if already exists
        if (photoBodiesRef.current.has(photo.id)) return;

        try {
            const dataUrl = await preloadImage(photo.url);
            const worldWidth = canvasRef.current.width;
            const body = createPhotoBody(dataUrl, worldWidth);

            Matter.World.add(worldRef.current, body);
            photoBodiesRef.current.set(photo.id, body);
            setPhotoCount(prev => prev + 1);
        } catch (error) {
            console.warn('Failed to add photo:', photo.id, error);
        }
    }, [createPhotoBody, preloadImage]);

    // Scale existing photos when photoSize changes
    useEffect(() => {
        if (!worldRef.current || photoBodiesRef.current.size === 0) return;

        const sizeMultiplier = photoSize / 100;

        photoBodiesRef.current.forEach((body) => {
            // Calculate new scale based on photoSize
            const currentSprite = body.render?.sprite;
            if (currentSprite) {
                // Base size is around 100px, scale proportionally
                const baseScale = 0.25; // Base scale when photoSize is 100
                currentSprite.xScale = baseScale * sizeMultiplier;
                currentSprite.yScale = baseScale * sizeMultiplier;
            }

            // Also scale the body vertices for accurate physics
            const scaleFactor = sizeMultiplier;
            Matter.Body.scale(body, scaleFactor / (body as any)._lastScale || 1, scaleFactor / (body as any)._lastScale || 1);
            (body as any)._lastScale = scaleFactor;
        });
    }, [photoSize]);

    // Initialize Matter.js
    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Create engine
        const engine = Matter.Engine.create({
            gravity: { x: 0, y: 0.8, scale: 0.001 }
        });
        engineRef.current = engine;
        worldRef.current = engine.world;

        // Create renderer
        const render = Matter.Render.create({
            canvas: canvas,
            engine: engine,
            options: {
                width: width,
                height: height,
                wireframes: false,
                background: 'transparent',
                pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
            }
        });
        renderRef.current = render;

        // Wall options
        const wallOptions = {
            isStatic: true,
            render: {
                visible: false
            }
        };

        // Create boundaries (floor and walls)
        const wallThickness = 100;
        const floor = Matter.Bodies.rectangle(
            width / 2,
            height + wallThickness / 2 - 10,
            width * 2,
            wallThickness,
            wallOptions
        );
        const leftWall = Matter.Bodies.rectangle(
            -wallThickness / 2,
            height / 2,
            wallThickness,
            height * 2,
            wallOptions
        );
        const rightWall = Matter.Bodies.rectangle(
            width + wallThickness / 2,
            height / 2,
            wallThickness,
            height * 2,
            wallOptions
        );

        Matter.World.add(engine.world, [floor, leftWall, rightWall]);

        // Add mouse control
        const mouse = Matter.Mouse.create(canvas);
        const mouseConstraint = Matter.MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: {
                    visible: false
                }
            }
        });

        Matter.World.add(engine.world, mouseConstraint);

        // Keep mouse in sync with rendering
        render.mouse = mouse;

        // Create runner
        const runner = Matter.Runner.create();
        runnerRef.current = runner;
        Matter.Runner.run(runner, engine);

        // Run renderer
        Matter.Render.run(render);

        setIsLoading(false);

        // Handle resize
        const handleResize = () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;

            render.canvas.width = newWidth;
            render.canvas.height = newHeight;
            render.options.width = newWidth;
            render.options.height = newHeight;

            // Update floor position
            Matter.Body.setPosition(floor, { x: newWidth / 2, y: newHeight + wallThickness / 2 - 10 });

            // Update wall positions
            Matter.Body.setPosition(rightWall, { x: newWidth + wallThickness / 2, y: newHeight / 2 });
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            Matter.Render.stop(render);
            Matter.Runner.stop(runner);
            Matter.Engine.clear(engine);
        };
    }, []);

    // Firebase sync - Load photos from Firestore in real-time
    useEffect(() => {
        if (isLoading) return;

        const photosRef = collection(db, 'events', eventSlug, 'media')
        const q = query(photosRef, orderBy('timestamp', 'desc'), limit(50))

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                // No Firebase data - show demo photos as fallback
                let photoIndex = 0;
                const addDemoPhotos = async () => {
                    for (let i = 0; i < 5; i++) {
                        const photo: Photo = {
                            id: `demo-${i}`,
                            url: DEMO_PHOTO_URLS[i % DEMO_PHOTO_URLS.length],
                            timestamp: Date.now()
                        };
                        await new Promise(resolve => setTimeout(resolve, 600));
                        addPhoto(photo);
                    }
                };
                addDemoPhotos();
                return;
            }

            // Add new photos from Firebase
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data()
                    // Only add images (photos), not videos
                    if (data.type === 'photo' || !data.type) {
                        const photo: Photo = {
                            id: change.doc.id,
                            url: data.url,
                            timestamp: data.timestamp?.toMillis() || Date.now()
                        }
                        addPhoto(photo)
                    }
                }
            })
        }, (error) => {
            console.error('GravityWall Firebase sync error:', error)
            // Fallback to demo photos on error
            const addDemoPhotos = async () => {
                for (let i = 0; i < 5; i++) {
                    const photo: Photo = {
                        id: `demo-${i}`,
                        url: DEMO_PHOTO_URLS[i % DEMO_PHOTO_URLS.length],
                        timestamp: Date.now()
                    };
                    await new Promise(resolve => setTimeout(resolve, 600));
                    addPhoto(photo);
                }
            };
            addDemoPhotos();
        })

        return () => unsubscribe()
    }, [isLoading, eventSlug, addPhoto]);

    // Firebase sync is now active above - the old commented code has been removed

    return (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900">
            {/* Ambient background effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-3xl" />
            </div>

            {/* Physics canvas */}
            <canvas
                ref={canvasRef}
                className="gravity-canvas"
                style={{ background: 'transparent' }}
            />

            {/* Loading state */}
            {isLoading && (
                <div className="fixed inset-0 flex items-center justify-center z-50">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-accent-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white/70 text-lg">Iniciando el muro de fotos...</p>
                    </div>
                </div>
            )}

            {/* Event info overlay */}
            <div className="fixed top-6 left-6 z-10 glass rounded-xl p-4 pointer-events-none">
                <div className="flex items-center gap-3">
                    {/* TODO: REEMPLAZAR CON SVG DEL LOGO FINAL AQUÍ */}
                    <svg
                        className="w-8 h-8 text-accent-500"
                        viewBox="0 0 24 24"
                        fill="none"
                    >
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                        <circle cx="4" cy="8" r="2" fill="currentColor" opacity="0.7" />
                        <circle cx="20" cy="8" r="2" fill="currentColor" opacity="0.7" />
                        <circle cx="4" cy="16" r="2" fill="currentColor" opacity="0.7" />
                        <circle cx="20" cy="16" r="2" fill="currentColor" opacity="0.7" />
                        <path d="M12 12L4 8M12 12L20 8M12 12L4 16M12 12L20 16" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                    </svg>
                    <div>
                        <span className="text-lg font-bold gradient-text">Soy Nexo</span>
                        <p className="text-white/50 text-sm">{eventSlug}</p>
                    </div>
                </div>
            </div>

            {/* Photo counter */}
            <div className="fixed top-6 right-6 z-10 glass rounded-xl px-4 py-2 pointer-events-none">
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 0 002-2V6a2 0 00-2-2H6a2 0 00-2 2v12a2 0 002 2z" />
                    </svg>
                    <span className="text-white font-semibold">{photoCount}</span>
                    <span className="text-white/50 text-sm">fotos</span>
                </div>
            </div>

            {/* Photo size control */}
            <div className="fixed bottom-20 right-6 z-10 glass rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <input
                        type="range"
                        min="50"
                        max="150"
                        value={photoSize}
                        onChange={(e) => setPhotoSize(Number(e.target.value))}
                        className="w-24 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent-500"
                    />
                    <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <p className="text-white/50 text-xs text-center mt-1">Tamaño fotos</p>
            </div>

            {/* Instructions overlay */}
            <div className="fixed bottom-6 right-6 z-10 glass rounded-xl p-4 pointer-events-none">
                <p className="text-white/70 text-sm">
                    <span className="text-accent-400">💡</span> Arrastra las fotos con el mouse
                </p>
            </div>
        </div>
    );
}
