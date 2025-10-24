// Script to update existing songs with tenant information
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, update } = require('firebase/database');

// Use your existing Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAZsxb2zg04yx3hQGmnIwhOLqEYWmb2aEI",
  authDomain: "multitrack-player-app.firebaseapp.com",
  databaseURL: "https://multitrack-player-app-default-rtdb.firebaseio.com",
  projectId: "multitrack-player-app",
  storageBucket: "multitrack-player-app.firebasestorage.app",
  messagingSenderId: "1032913811889",
  appId: "1:1032913811889:web:7751664dfb4a7670932590"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function updateExistingSongs() {
  try {
    console.log('Updating existing songs with tenant information...');
    
    // Get all existing songs
    const songsRef = ref(database, 'songs');
    const snapshot = await get(songsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const songs = Object.entries(data);
      
      console.log(`Found ${songs.length} existing songs`);
      
      let updatedCount = 0;
      
      for (const [songId, songData] of songs) {
        const song = songData;
        
        // Only update songs that don't have tenantId
        if (!song.tenantId) {
          const updates = {
            tenantId: 'default-tenant',
            updatedAt: new Date().toISOString()
          };
          
          await update(ref(database, `songs/${songId}`), updates);
          console.log(`✅ Updated song: ${song.title || songId}`);
          updatedCount++;
        } else {
          console.log(`⏭️  Song already has tenant: ${song.title || songId}`);
        }
      }
      
      console.log(`\n🎉 Updated ${updatedCount} songs with tenant information!`);
      console.log('\nNow you can:');
      console.log('1. Go back to your app');
      console.log('2. Access the Song Assignment screen');
      console.log('3. You should now see your existing songs available for assignment');
      console.log('4. Assign them to organizations with different access levels');
      
    } else {
      console.log('No songs found in the database');
    }
    
  } catch (error) {
    console.error('Error updating existing songs:', error);
  }
}

updateExistingSongs();
