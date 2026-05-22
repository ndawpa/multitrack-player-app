# Multitrack Player Appp

A React Native application for playing and managing multitrack audio files.

## Building the APK

### Prerequisites
- Node.js and npm installed
- Android Studio and Android SDK installed
- ANDROID_HOME environment variable set
- Java Development Kit (JDK) installed

### Steps to Generate APK

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Generate Native Projects**
   ```bash
   npx expo prebuild
   ```

3. **Build the APK**
   ```bash
   cd android
   ./gradlew clean
   ./gradlew assembleRelease
   ```

The generated APK will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Notes
- Make sure you have all the required Android SDK components installed through Android Studio
- The build process might take several minutes depending on your system
- The APK will be signed with a debug key by default. For production, you'll need to configure signing keys

### Troubleshooting
If you encounter any build issues:
1. Make sure all Android SDK components are up to date
2. Check that the ANDROID_HOME environment variable is correctly set
3. Ensure you have enough disk space for the build process
4. Try running `./gradlew clean` before building again

## Setup

1. Firebase Setup:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Firebase Storage
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the downloaded JSON file as `serviceAccountKey.json` in the project root
   - Make sure to add this file to .gitignore (it's already included)

2. Run the app:
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
