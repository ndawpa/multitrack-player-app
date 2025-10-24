// Script to check the actual tenant ID
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

async function checkTenantId() {
  try {
    console.log('Checking tenant IDs...');
    
    // Get all tenants
    const tenantsRef = ref(database, 'tenants');
    const tenantsSnapshot = await get(tenantsRef);
    
    if (tenantsSnapshot.exists()) {
      const tenants = tenantsSnapshot.val();
      console.log('Available tenants:');
      Object.entries(tenants).forEach(([id, tenant]) => {
        console.log(`- ${id}: ${tenant.name}`);
      });
    } else {
      console.log('No tenants found');
    }
    
    // Check what tenantId the songs have
    const songsRef = ref(database, 'songs');
    const songsSnapshot = await get(songsRef);
    
    if (songsSnapshot.exists()) {
      const songs = songsSnapshot.val();
      const tenantIds = new Set();
      
      Object.values(songs).forEach(song => {
        if (song.tenantId) {
          tenantIds.add(song.tenantId);
        }
      });
      
      console.log('\nTenant IDs found in songs:');
      Array.from(tenantIds).forEach(id => {
        console.log(`- ${id}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking tenant ID:', error);
  }
}

checkTenantId();
