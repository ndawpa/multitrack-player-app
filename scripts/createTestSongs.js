// Script to create test songs for the tenant system
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

async function createTestSongs() {
  try {
    console.log('Creating test songs for tenant system...');
    
    const testSongs = [
      {
        id: 'song-1',
        title: 'Company Anthem',
        artist: 'Corporate Band',
        tenantId: 'default-tenant',
        organizationId: null, // Not assigned to any organization yet
        accessLevel: 'public',
        tracks: [
          {
            id: 'track-1-1',
            name: 'Main Version',
            path: 'audio/company-anthem/main-version.mp3'
          },
          {
            id: 'track-1-2',
            name: 'Instrumental',
            path: 'audio/company-anthem/instrumental.mp3'
          }
        ],
        lyrics: 'We are the champions of our company...',
        scores: [
          {
            id: 'score-1-1',
            name: 'Piano Score',
            type: 'pdf',
            url: 'https://example.com/piano-score.pdf',
            description: 'Piano arrangement of the company anthem'
          }
        ],
        resources: [
          {
            id: 'resource-1-1',
            name: 'Music Video',
            type: 'youtube',
            url: 'https://youtube.com/watch?v=example1',
            description: 'Official music video'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        id: 'song-2',
        title: 'Training Jingle',
        artist: 'Learning Team',
        tenantId: 'default-tenant',
        organizationId: null,
        accessLevel: 'public',
        tracks: [
          {
            id: 'track-2-1',
            name: 'Full Version',
            path: 'audio/training-jingle/full-version.mp3'
          },
          {
            id: 'track-2-2',
            name: 'Short Version',
            path: 'audio/training-jingle/short-version.mp3'
          }
        ],
        lyrics: 'Learn and grow, that\'s the way to go...',
        scores: [],
        resources: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        id: 'song-3',
        title: 'Marketing Theme',
        artist: 'Marketing Department',
        tenantId: 'default-tenant',
        organizationId: null,
        accessLevel: 'private',
        tracks: [
          {
            id: 'track-3-1',
            name: 'Full Mix',
            path: 'audio/marketing-theme/full-mix.mp3'
          }
        ],
        lyrics: 'Sell, sell, sell with our marketing theme...',
        scores: [],
        resources: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      },
      {
        id: 'song-4',
        title: 'Sales Victory Song',
        artist: 'Sales Team',
        tenantId: 'default-tenant',
        organizationId: null,
        accessLevel: 'restricted',
        tracks: [
          {
            id: 'track-4-1',
            name: 'Celebration Mix',
            path: 'audio/sales-victory/celebration-mix.mp3'
          }
        ],
        lyrics: 'We closed the deal, we made it real...',
        scores: [],
        resources: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      }
    ];

    // Save all test songs
    for (const song of testSongs) {
      await set(ref(database, `songs/${song.id}`), song);
      console.log(`✅ Created song: ${song.title}`);
    }

    console.log('\n🎉 Test songs created successfully!');
    console.log('\nSongs created:');
    testSongs.forEach(song => {
      console.log(`- ${song.title} by ${song.artist} (${song.accessLevel} access)`);
    });
    
    console.log('\nNext steps:');
    console.log('1. Go back to your app');
    console.log('2. Refresh the Song Assignment screen');
    console.log('3. You should now see 4 test songs available for assignment');
    console.log('4. Click on any song to assign it to an organization');
    
  } catch (error) {
    console.error('Error creating test songs:', error);
  }
}

createTestSongs();
