# Multitrack Player App

A React Native Expo app for playing and managing multitrack audio files.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Firebase Setup:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Firebase Storage
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the downloaded JSON file as `serviceAccountKey.json` in the project root
   - Make sure to add this file to .gitignore (it's already included)

3. Run the app:
```bash
npm start
```

## Development

### Adding New Songs

1. Upload audio files to Firebase Storage:
   - Place your audio files in the `assets/audio` directory
   - Run the upload script:
   ```bash
   node scripts/uploadAudioFiles.js
   ```
   - Remove the local files after successful upload

2. Add song information to the `songs` array in `src/app/index.tsx`

## Security

- Never commit `serviceAccountKey.json` to version control
- Keep your Firebase configuration secure
- Use environment variables for sensitive data in production 