// Test script to verify organization creation works
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

async function testOrganizationCreation() {
  try {
    console.log('Testing organization creation...');
    
    // Test creating an organization without parentId
    const testOrg = {
      id: 'test-org-1',
      tenantId: 'default-tenant',
      name: 'Test Organization',
      description: 'Test organization without parent',
      settings: {
        allowSubOrganizations: true,
        maxSubOrganizations: 10,
        songAccessLevel: 'public',
        canCreateSongs: true,
        canEditSongs: true,
        canDeleteSongs: false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test',
      isActive: true
    };

    // Clean the data (remove undefined parentId)
    const cleanData = {
      id: testOrg.id,
      tenantId: testOrg.tenantId,
      name: testOrg.name,
      description: testOrg.description,
      settings: testOrg.settings,
      createdAt: testOrg.createdAt,
      updatedAt: testOrg.updatedAt,
      createdBy: testOrg.createdBy,
      isActive: testOrg.isActive
    };
    
    await set(ref(database, `organizations/${testOrg.id}`), cleanData);
    console.log('✅ Test organization created successfully');
    
    // Test creating an organization with parentId
    const testOrgWithParent = {
      id: 'test-org-2',
      tenantId: 'default-tenant',
      name: 'Test Sub Organization',
      description: 'Test organization with parent',
      parentId: 'test-org-1',
      settings: {
        allowSubOrganizations: true,
        maxSubOrganizations: 10,
        songAccessLevel: 'public',
        canCreateSongs: true,
        canEditSongs: true,
        canDeleteSongs: false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test',
      isActive: true
    };

    // Clean the data (include parentId)
    const cleanDataWithParent = {
      id: testOrgWithParent.id,
      tenantId: testOrgWithParent.tenantId,
      name: testOrgWithParent.name,
      description: testOrgWithParent.description,
      parentId: testOrgWithParent.parentId,
      settings: testOrgWithParent.settings,
      createdAt: testOrgWithParent.createdAt,
      updatedAt: testOrgWithParent.updatedAt,
      createdBy: testOrgWithParent.createdBy,
      isActive: testOrgWithParent.isActive
    };
    
    await set(ref(database, `organizations/${testOrgWithParent.id}`), cleanDataWithParent);
    console.log('✅ Test sub-organization created successfully');
    
    console.log('\n🎉 Organization creation test complete!');
    console.log('The tenant system should now work properly for creating organizations.');
    
  } catch (error) {
    console.error('Error testing organization creation:', error);
  }
}

testOrganizationCreation();
