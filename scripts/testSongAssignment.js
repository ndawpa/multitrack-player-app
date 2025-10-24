// Test script to verify song assignment works
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set } = require('firebase/database');

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

async function testSongAssignment() {
  try {
    console.log('Testing song assignment...');
    
    // Create a test song access record without expiresAt
    const songAccess = {
      id: 'test-access-1',
      songId: 'test-song-1',
      tenantId: 'default-tenant',
      organizationId: 'default-org',
      accessLevel: 'public',
      grantedBy: 'test-user',
      grantedAt: new Date().toISOString()
      // Note: no expiresAt field
    };

    await set(ref(database, `songAccess/${songAccess.id}`), songAccess);
    console.log('✅ Song access record created successfully');
    
    // Clean up
    await set(ref(database, `songAccess/${songAccess.id}`), null);
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 Song assignment test passed!');
    console.log('The song assignment should now work without errors.');
    
  } catch (error) {
    console.error('Error testing song assignment:', error);
  }
}

testSongAssignment();