const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "multitrack-player-app.firebasestorage.app"
});

const bucket = admin.storage().bucket();

async function uploadFile(filePath, destination) {
  try {
    await bucket.upload(filePath, {
      destination,
      metadata: {
        contentType: 'audio/mpeg',
      },
    });
    console.log(`Uploaded ${filePath} to ${destination}`);
  } catch (error) {
    console.error(`Error uploading ${filePath}:`, error);
  }
}

async function uploadDirectory(directoryPath, baseDestination = '') {
  const files = fs.readdirSync(directoryPath);
  
  for (const file of files) {
    const fullPath = path.join(directoryPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      await uploadDirectory(fullPath, path.join(baseDestination, file));
    } else if (file.endsWith('.mp3')) {
      const destination = path.join(baseDestination, file);
      await uploadFile(fullPath, destination);
    }
  }
}

// Upload all audio files
const audioDir = path.join(__dirname, '../assets/audio');
uploadDirectory(audioDir, 'audio')
  .then(() => {
    console.log('Upload complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Upload failed:', error);
    process.exit(1);
  }); 