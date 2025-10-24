const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://multitrack-player-app-default-rtdb.firebaseio.com",
  storageBucket: "multitrack-player-app.firebasestorage.app"
});

const db = admin.database();

async function setupTenantSystem() {
  try {
    console.log('Setting up tenant system...');
    
    // Create a default tenant for testing
    const defaultTenant = {
      id: 'default-tenant',
      name: 'Default Organization',
      description: 'Default tenant for testing',
      settings: {
        allowUserRegistration: true,
        requireAdminApproval: false,
        allowedFileTypes: ['mp3', 'wav', 'm4a'],
        maxFileSize: 50
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'system',
      isActive: true
    };

    // Save default tenant
    await db.ref('tenants/default-tenant').set(defaultTenant);
    console.log('✅ Default tenant created');

    // Create default roles for the tenant
    const defaultRoles = {
      'default-tenant-owner': {
        id: 'default-tenant-owner',
        tenantId: 'default-tenant',
        name: 'owner',
        description: 'Default owner role',
        permissions: {
          canInviteUsers: true,
          canRemoveUsers: true,
          canAssignRoles: true,
          canViewAllUsers: true,
          canCreateOrganizations: true,
          canEditOrganizations: true,
          canDeleteOrganizations: true,
          canAssignUsersToOrganizations: true,
          canCreateSongs: true,
          canEditAllSongs: true,
          canDeleteAllSongs: true,
          canViewAllSongs: true,
          canAssignSongsToOrganizations: true,
          canEditTenantSettings: true,
          canDeleteTenant: true,
          canViewTenantAnalytics: true
        },
        isSystemRole: true,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      'default-tenant-member': {
        id: 'default-tenant-member',
        tenantId: 'default-tenant',
        name: 'member',
        description: 'Default member role',
        permissions: {
          canInviteUsers: false,
          canRemoveUsers: false,
          canAssignRoles: false,
          canViewAllUsers: false,
          canCreateOrganizations: false,
          canEditOrganizations: false,
          canDeleteOrganizations: false,
          canAssignUsersToOrganizations: false,
          canCreateSongs: true,
          canEditAllSongs: false,
          canDeleteAllSongs: false,
          canViewAllSongs: true,
          canAssignSongsToOrganizations: false,
          canEditTenantSettings: false,
          canDeleteTenant: false,
          canViewTenantAnalytics: false
        },
        isSystemRole: true,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      }
    };

    // Save default roles
    await db.ref('tenantRoles').update(defaultRoles);
    console.log('✅ Default roles created');

    // Create a default organization
    const defaultOrganization = {
      id: 'default-org',
      tenantId: 'default-tenant',
      name: 'Main Organization',
      description: 'Default organization for all users',
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
      createdBy: 'system',
      isActive: true
    };

    await db.ref('organizations/default-org').set(defaultOrganization);
    console.log('✅ Default organization created');

    console.log('\n🎉 Tenant system setup complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy the database rules: firebase deploy --only database');
    console.log('2. Restart your app');
    console.log('3. Login and you should see a business icon in the header');
    console.log('4. Click the business icon to access tenant management');
    
  } catch (error) {
    console.error('Error setting up tenant system:', error);
  }
}

setupTenantSystem();
