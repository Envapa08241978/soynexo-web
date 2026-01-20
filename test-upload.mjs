// Test script to upload a sample image to Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyA9QImupPIqQMp51OXTJUqHgDwAy_14TLU",
    authDomain: "soy-nexo.firebaseapp.com",
    projectId: "soy-nexo",
    storageBucket: "soy-nexo.firebasestorage.app",
    messagingSenderId: "232450038406",
    appId: "1:232450038406:web:e4a463b0c74e2bc466e3a1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadTestMedia() {
    const eventSlug = 'demo-evento';

    // Add a test photo entry to Firestore
    const testMedia = {
        url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800',
        type: 'photo',
        timestamp: serverTimestamp(),
        fileName: `test-${Date.now()}.jpg`
    };

    try {
        const docRef = await addDoc(collection(db, 'events', eventSlug, 'media'), testMedia);
        console.log('✅ Test photo added successfully!');
        console.log('Document ID:', docRef.id);
        console.log('URL:', testMedia.url);
        console.log('\n🔄 Check the gallery - it should update in real-time!');
    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

uploadTestMedia();
