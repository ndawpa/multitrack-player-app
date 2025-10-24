// Script to load existing users from the database
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

async function loadUsers() {
  try {
    console.log('Loading users from database...');
    
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
      const users = snapshot.val();
      const userList = Object.entries(users).map(([id, user]) => ({
        id,
        email: user.email || 'no-email@example.com',
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : `User ${id}`),
        avatar: user.avatar,
        emailVerified: user.emailVerified || false,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt
      }));
      
      console.log(`Found ${userList.length} users:`);
      userList.forEach((user, index) => {
        console.log(`${index + 1}. ${user.displayName} (${user.email})`);
      });
      
      return userList;
    } else {
      console.log('No users found in database');
      return [];
    }
    
  } catch (error) {
    console.error('Error loading users:', error);
    return [];
  }
}

loadUsers();
