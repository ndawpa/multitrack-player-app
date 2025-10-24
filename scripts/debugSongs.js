// Debug script to check what songs are available
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

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

async function debugSongs() {
  try {
    console.log('Debugging songs in database...');
    
    // Get all songs
    const songsRef = ref(database, 'songs');
    const snapshot = await get(songsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const songs = Object.entries(data);
      
      console.log(`Total songs found: ${songs.length}`);
      
      // Check songs with tenantId
      const songsWithTenant = songs.filter(([id, song]) => song.tenantId);
      console.log(`Songs with tenantId: ${songsWithTenant.length}`);
      
      // Check songs for default-tenant
      const defaultTenantSongs = songs.filter(([id, song]) => 
        song.tenantId === 'default-tenant' || !song.tenantId
      );
      console.log(`Songs for default-tenant: ${defaultTenantSongs.length}`);
      
      // Show first 5 songs
      console.log('\nFirst 5 songs:');
      defaultTenantSongs.slice(0, 5).forEach(([id, song]) => {
        console.log(`- ${song.title} (tenantId: ${song.tenantId || 'none'})`);
      });
      
      // Check if there are any songs without tenantId
      const songsWithoutTenant = songs.filter(([id, song]) => !song.tenantId);
      console.log(`\nSongs without tenantId: ${songsWithoutTenant.length}`);
      
      if (songsWithoutTenant.length > 0) {
        console.log('First 3 songs without tenantId:');
        songsWithoutTenant.slice(0, 3).forEach(([id, song]) => {
          console.log(`- ${song.title}`);
        });
      }
      
    } else {
      console.log('No songs found in database');
    }
    
  } catch (error) {
    console.error('Error debugging songs:', error);
  }
}

debugSongs();
