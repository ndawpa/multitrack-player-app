// Test script to verify tenant system is working
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

async function testTenantSystem() {
  try {
    console.log('Testing tenant system...');
    
    // Test 1: Check if default tenant exists
    const tenantRef = ref(database, 'tenants/default-tenant');
    const tenantSnapshot = await get(tenantRef);
    
    if (tenantSnapshot.exists()) {
      console.log('✅ Default tenant found:', tenantSnapshot.val().name);
    } else {
      console.log('❌ Default tenant not found');
    }
    
    // Test 2: Check if default roles exist
    const rolesRef = ref(database, 'tenantRoles');
    const rolesSnapshot = await get(rolesRef);
    
    if (rolesSnapshot.exists()) {
      const roles = rolesSnapshot.val();
      console.log('✅ Found roles:', Object.keys(roles));
    } else {
      console.log('❌ No roles found');
    }
    
    // Test 3: Check if default organization exists
    const orgRef = ref(database, 'organizations/default-org');
    const orgSnapshot = await get(orgRef);
    
    if (orgSnapshot.exists()) {
      console.log('✅ Default organization found:', orgSnapshot.val().name);
    } else {
      console.log('❌ Default organization not found');
    }
    
    console.log('\n🎉 Tenant system test complete!');
    console.log('\nNext steps:');
    console.log('1. Update Firebase database rules in the console');
    console.log('2. Restart your app');
    console.log('3. Login and look for the business icon (🏢) in the header');
    console.log('4. Click the business icon to access tenant management');
    
  } catch (error) {
    console.error('Error testing tenant system:', error);
  }
}

testTenantSystem();
