// Script to create test data for assignments
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, push } = require('firebase/database');

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

async function createTestData() {
  try {
    console.log('Creating test data...');
    
    // Create test users
    const testUsers = [
      {
        id: 'test-user-1',
        email: 'john.doe@example.com',
        displayName: 'John Doe',
        avatar: null,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        role: 'user'
      },
      {
        id: 'test-user-2',
        email: 'jane.smith@example.com',
        displayName: 'Jane Smith',
        avatar: null,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        role: 'user'
      },
      {
        id: 'test-user-3',
        email: 'bob.wilson@example.com',
        displayName: 'Bob Wilson',
        avatar: null,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        role: 'user'
      }
    ];

    // Create test groups
    const testGroups = [
      {
        id: 'test-group-1',
        name: 'Test Group 1',
        description: 'First test group',
        members: ['test-user-1', 'test-user-2'],
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        color: '#BB86FC',
        icon: 'people'
      },
      {
        id: 'test-group-2',
        name: 'Test Group 2',
        description: 'Second test group',
        members: ['test-user-2', 'test-user-3'],
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        color: '#4CAF50',
        icon: 'star'
      },
      {
        id: 'test-group-3',
        name: 'Test Group 3',
        description: 'Third test group',
        members: ['test-user-1', 'test-user-3'],
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        color: '#FF5722',
        icon: 'heart'
      }
    ];

    // Create group memberships
    const groupMemberships = {
      'test-user-1': {
        'test-group-1': {
          addedBy: 'admin',
          addedAt: new Date().toISOString(),
          isActive: true
        },
        'test-group-3': {
          addedBy: 'admin',
          addedAt: new Date().toISOString(),
          isActive: true
        }
      },
      'test-user-2': {
        'test-group-1': {
          addedBy: 'admin',
          addedAt: new Date().toISOString(),
          isActive: true
        },
        'test-group-2': {
          addedBy: 'admin',
          addedAt: new Date().toISOString(),
          isActive: true
        }
      },
      'test-user-3': {
        'test-group-2': {
          addedBy: 'admin',
          addedAt: new Date().toISOString(),
          isActive: true
        },
        'test-group-3': {
          addedBy: 'admin',
          addedAt: new Date().toISOString(),
          isActive: true
        }
      }
    };

    // Save users
    for (const user of testUsers) {
      await set(ref(database, `users/${user.id}`), user);
      console.log(`Created user: ${user.displayName}`);
    }

    // Save groups
    for (const group of testGroups) {
      await set(ref(database, `userGroups/${group.id}`), group);
      console.log(`Created group: ${group.name}`);
    }

    // Save group memberships
    await set(ref(database, 'groupMemberships'), groupMemberships);
    console.log('Created group memberships');

    console.log('✅ Test data created successfully!');
    console.log('Now you should see assignments in the Assignments tab:');
    console.log('- John Doe → Test Group 1, Test Group 3');
    console.log('- Jane Smith → Test Group 1, Test Group 2');
    console.log('- Bob Wilson → Test Group 2, Test Group 3');

  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

createTestData();
