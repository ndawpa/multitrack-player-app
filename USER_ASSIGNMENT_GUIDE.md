# User Assignment Guide

## How to Assign Users to Organizations

### Step 1: Access Tenant Management
1. Login to your app
2. Click the business icon (🏢) in the header
3. Select your tenant

### Step 2: Navigate to Organizations
1. You'll see a list of organizations in your tenant
2. Click on any organization to manage its users

### Step 3: Assign Users
1. Click the "+" button to invite a new user
2. Enter the user's email address
3. Select their role:
   - **Owner**: Full access to tenant and all organizations
   - **Admin**: Can manage users and organizations, create songs
   - **Member**: Can create and view songs
   - **Viewer**: Can only view songs
4. Click "Send" to send the invitation

### Step 4: Manage Existing Users
- View all users assigned to the organization
- See their roles and assignment dates
- Remove users if needed

## User Roles Explained

### Owner
- Full access to tenant settings
- Can delete the tenant
- Can manage all users and organizations
- Can assign songs to any organization
- Can view analytics

### Admin
- Can manage users and organizations
- Can create and edit songs
- Cannot delete the tenant
- Can assign songs to organizations
- Can view analytics

### Member
- Can create songs
- Can view all songs in their organization
- Cannot manage other users
- Cannot edit tenant settings

### Viewer
- Can only view songs
- Cannot create or edit anything
- Read-only access

## Organization Structure

```
Tenant (e.g., "Acme Corporation")
├── Organization 1 (e.g., "Marketing Team")
│   ├── User A (Member)
│   └── User B (Viewer)
├── Organization 2 (e.g., "Sales Team")
│   ├── User C (Admin)
│   └── User D (Member)
└── Organization 3 (e.g., "Development Team")
    ├── User E (Owner)
    └── User F (Member)
```

## Song Access Control

### Public Songs
- Visible to all users in the tenant
- Can be accessed by any organization

### Private Songs
- Only visible to specific organizations
- Users must be assigned to that organization

### Restricted Songs
- Limited access based on user permissions
- Requires specific role to access

## Best Practices

1. **Start with a few admins**: Don't give everyone owner access initially
2. **Use organizations for teams**: Group users by department or function
3. **Assign appropriate roles**: Match roles to user responsibilities
4. **Regularly review access**: Remove users who no longer need access
5. **Use descriptive names**: Make it clear what each organization is for

## Troubleshooting

### User Can't See Songs
- Check if they're assigned to the correct organization
- Verify their role has the right permissions
- Ensure songs are assigned to their organization

### Can't Invite Users
- Make sure you have admin or owner role
- Check if the email address is valid
- Verify the user exists in the system

### Permission Errors
- Check your role in the tenant
- Ensure you have the right permissions for the action
- Contact a tenant owner if needed
