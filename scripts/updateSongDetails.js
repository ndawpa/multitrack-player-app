const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://multitrack-player-app-default-rtdb.firebaseio.com",
  storageBucket: "multitrack-player-app.firebasestorage.app"
});

const db = admin.database();

/**
 * Updates songs based on artist name
 * @param {string} oldArtist - The current artist name to search for
 * @param {string} newArtist - The new artist name to set
 * @param {string} album - The album name to add
 */
async function updateSongDetails(oldArtist, newArtist, album) {
  try {
    console.log(`\nStarting update for songs with artist: "${oldArtist}"`);
    console.log(`New artist: "${newArtist}"`);
    console.log(`New album: "${album}"`);
    console.log('---\n');
    
    // Get reference to all songs
    const songsRef = db.ref('songs');
    const snapshot = await songsRef.once('value');
    const allSongs = snapshot.val();
    
    if (!allSongs) {
      console.log('No songs found in database.');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    const updatedSongs = [];
    
    // Iterate through all songs
    for (const [songId, song] of Object.entries(allSongs)) {
      if (!song || !song.artist) {
        continue;
      }
      
      // Check if artist matches (case-insensitive)
      if (song.artist.trim() === oldArtist.trim()) {
        console.log(`Found song: "${song.title}" (ID: ${songId})`);
        console.log(`  Current artist: "${song.artist}"`);
        console.log(`  Current album: ${song.album || '(none)'}`);
        
        // Prepare update
        const updates = {
          artist: newArtist,
          album: album,
          updatedAt: admin.database.ServerValue.TIMESTAMP
        };
        
        // Update the song
        const songRef = db.ref(`songs/${songId}`);
        await songRef.update(updates);
        
        updatedCount++;
        updatedSongs.push({
          id: songId,
          title: song.title,
          oldArtist: song.artist,
          newArtist: newArtist,
          album: album
        });
        
        console.log(`  ✓ Updated to artist: "${newArtist}", album: "${album}"`);
        console.log('');
      } else {
        skippedCount++;
      }
    }
    
    console.log('---');
    console.log(`Update completed!`);
    console.log(`  Updated: ${updatedCount} song(s)`);
    console.log(`  Skipped: ${skippedCount} song(s)`);
    
    if (updatedSongs.length > 0) {
      console.log('\nUpdated songs:');
      updatedSongs.forEach(song => {
        console.log(`  - "${song.title}" (${song.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error during update:', error);
    throw error;
  }
}

/**
 * Updates songs where artist starts with "CD Jovem"
 * Extracts the album name from the artist and sets artist to "Ministério Jovem"
 * Example: "CD Jovem 1993 - Já É Tempo" -> Artist: "Ministério Jovem", Album: "1993 - Já É Tempo"
 */
async function updateCDJovemSongs() {
  try {
    console.log(`\nStarting update for songs with artist starting with "CD Jovem"`);
    console.log(`New artist: "Ministério Jovem"`);
    console.log(`Album will be extracted from artist name`);
    console.log('---\n');
    
    // Get reference to all songs
    const songsRef = db.ref('songs');
    const snapshot = await songsRef.once('value');
    const allSongs = snapshot.val();
    
    if (!allSongs) {
      console.log('No songs found in database.');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    const updatedSongs = [];
    
    // Iterate through all songs
    for (const [songId, song] of Object.entries(allSongs)) {
      if (!song || !song.artist) {
        skippedCount++;
        continue;
      }
      
      const artist = song.artist.trim();
      
      // Check if artist starts with "CD Jovem" (case-insensitive)
      if (artist.toLowerCase().startsWith('cd jovem')) {
        // Extract the album name (everything after "CD Jovem" with optional space)
        let album = artist.replace(/^cd jovem\s*/i, '').trim();
        
        // If album is empty, skip this song
        if (!album) {
          console.log(`Skipping "${song.title}" - no album name found after "CD Jovem"`);
          skippedCount++;
          continue;
        }
        
        console.log(`Found song: "${song.title}" (ID: ${songId})`);
        console.log(`  Current artist: "${song.artist}"`);
        console.log(`  Current album: ${song.album || '(none)'}`);
        console.log(`  Extracted album: "${album}"`);
        
        // Prepare update
        const updates = {
          artist: 'Ministério Jovem',
          album: album,
          updatedAt: admin.database.ServerValue.TIMESTAMP
        };
        
        // Update the song
        const songRef = db.ref(`songs/${songId}`);
        await songRef.update(updates);
        
        updatedCount++;
        updatedSongs.push({
          id: songId,
          title: song.title,
          oldArtist: song.artist,
          newArtist: 'Ministério Jovem',
          album: album
        });
        
        console.log(`  ✓ Updated to artist: "Ministério Jovem", album: "${album}"`);
        console.log('');
      } else {
        skippedCount++;
      }
    }
    
    console.log('---');
    console.log(`Update completed!`);
    console.log(`  Updated: ${updatedCount} song(s)`);
    console.log(`  Skipped: ${skippedCount} song(s)`);
    
    if (updatedSongs.length > 0) {
      console.log('\nUpdated songs:');
      updatedSongs.forEach(song => {
        console.log(`  - "${song.title}" (${song.id})`);
        console.log(`    ${song.oldArtist} -> Ministério Jovem / ${song.album}`);
      });
    }
    
  } catch (error) {
    console.error('Error during update:', error);
    throw error;
  }
}

/**
 * Updates songs where artist contains "Celebra São Paulo Vol 1/2/3"
 * Extracts the volume number and sets artist to "Celebra São Paulo" with album as "Vol 1/2/3"
 * Example: "Celebra São Paulo Vol 1" -> Artist: "Celebra São Paulo", Album: "Vol 1"
 */
async function updateCelebraSaoPauloSongs() {
  try {
    console.log(`\nStarting update for songs with artist containing "Celebra São Paulo Vol"`);
    console.log(`New artist: "Celebra São Paulo"`);
    console.log(`Album will be extracted as Vol 1, Vol 2, or Vol 3`);
    console.log('---\n');
    
    // Get reference to all songs
    const songsRef = db.ref('songs');
    const snapshot = await songsRef.once('value');
    const allSongs = snapshot.val();
    
    if (!allSongs) {
      console.log('No songs found in database.');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    const updatedSongs = [];
    
    // Iterate through all songs
    for (const [songId, song] of Object.entries(allSongs)) {
      if (!song || !song.artist) {
        skippedCount++;
        continue;
      }
      
      const artist = song.artist.trim();
      
      // Check if artist contains "Celebra São Paulo Vol" (case-insensitive)
      const match = artist.match(/celebra\s+são\s+paulo\s+vol\s+([123])/i);
      
      if (match) {
        const volume = `Vol ${match[1]}`;
        
        console.log(`Found song: "${song.title}" (ID: ${songId})`);
        console.log(`  Current artist: "${song.artist}"`);
        console.log(`  Current album: ${song.album || '(none)'}`);
        console.log(`  Extracted volume: "${volume}"`);
        
        // Prepare update
        const updates = {
          artist: 'Celebra São Paulo',
          album: volume,
          updatedAt: admin.database.ServerValue.TIMESTAMP
        };
        
        // Update the song
        const songRef = db.ref(`songs/${songId}`);
        await songRef.update(updates);
        
        updatedCount++;
        updatedSongs.push({
          id: songId,
          title: song.title,
          oldArtist: song.artist,
          newArtist: 'Celebra São Paulo',
          album: volume
        });
        
        console.log(`  ✓ Updated to artist: "Celebra São Paulo", album: "${volume}"`);
        console.log('');
      } else {
        skippedCount++;
      }
    }
    
    console.log('---');
    console.log(`Update completed!`);
    console.log(`  Updated: ${updatedCount} song(s)`);
    console.log(`  Skipped: ${skippedCount} song(s)`);
    
    if (updatedSongs.length > 0) {
      console.log('\nUpdated songs:');
      updatedSongs.forEach(song => {
        console.log(`  - "${song.title}" (${song.id})`);
        console.log(`    ${song.oldArtist} -> Celebra São Paulo / ${song.album}`);
      });
    }
    
  } catch (error) {
    console.error('Error during update:', error);
    throw error;
  }
}

/**
 * Updates songs where artist is "Novo Hinário" or "Antigo Hinário"
 * Sets artist to "Hinário Adventista" and album to "Novo Hinário" or "Antigo Hinário" respectively
 */
async function updateHinarioSongs() {
  try {
    console.log(`\nStarting update for songs with artist "Novo Hinário" or "Antigo Hinário"`);
    console.log(`New artist: "Hinário Adventista"`);
    console.log(`Album will be "Novo Hinário" or "Antigo Hinário"`);
    console.log('---\n');
    
    // Get reference to all songs
    const songsRef = db.ref('songs');
    const snapshot = await songsRef.once('value');
    const allSongs = snapshot.val();
    
    if (!allSongs) {
      console.log('No songs found in database.');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    const updatedSongs = [];
    
    // Iterate through all songs
    for (const [songId, song] of Object.entries(allSongs)) {
      if (!song || !song.artist) {
        skippedCount++;
        continue;
      }
      
      const artist = song.artist.trim();
      let newArtist = null;
      let album = null;
      
      // Check if artist is "Novo Hinário" or "Antigo Hinário" (case-insensitive)
      if (artist.toLowerCase() === 'novo hinário') {
        newArtist = 'Hinário Adventista';
        album = 'Novo Hinário';
      } else if (artist.toLowerCase() === 'antigo hinário') {
        newArtist = 'Hinário Adventista';
        album = 'Antigo Hinário';
      }
      
      if (newArtist && album) {
        console.log(`Found song: "${song.title}" (ID: ${songId})`);
        console.log(`  Current artist: "${song.artist}"`);
        console.log(`  Current album: ${song.album || '(none)'}`);
        console.log(`  New album: "${album}"`);
        
        // Prepare update
        const updates = {
          artist: newArtist,
          album: album,
          updatedAt: admin.database.ServerValue.TIMESTAMP
        };
        
        // Update the song
        const songRef = db.ref(`songs/${songId}`);
        await songRef.update(updates);
        
        updatedCount++;
        updatedSongs.push({
          id: songId,
          title: song.title,
          oldArtist: song.artist,
          newArtist: newArtist,
          album: album
        });
        
        console.log(`  ✓ Updated to artist: "${newArtist}", album: "${album}"`);
        console.log('');
      } else {
        skippedCount++;
      }
    }
    
    console.log('---');
    console.log(`Update completed!`);
    console.log(`  Updated: ${updatedCount} song(s)`);
    console.log(`  Skipped: ${skippedCount} song(s)`);
    
    if (updatedSongs.length > 0) {
      console.log('\nUpdated songs:');
      updatedSongs.forEach(song => {
        console.log(`  - "${song.title}" (${song.id})`);
        console.log(`    ${song.oldArtist} -> ${song.newArtist} / ${song.album}`);
      });
    }
    
  } catch (error) {
    console.error('Error during update:', error);
    throw error;
  }
}

/**
 * Updates songs where artist contains "Ministério de Louvor" followed by a number and album name
 * Extracts the album name and sets artist to "Ministério de Louvor"
 * Example: "Ministério de Louvor 1 - Chuva de Bençãos" -> Artist: "Ministério de Louvor", Album: "Chuva de Bençãos"
 */
async function updateMinisterioDeLouvorSongs() {
  try {
    console.log(`\nStarting update for songs with artist containing "Ministério de Louvor"`);
    console.log(`New artist: "Ministério de Louvor"`);
    console.log(`Album will be extracted from artist name`);
    console.log('---\n');
    
    // Get reference to all songs
    const songsRef = db.ref('songs');
    const snapshot = await songsRef.once('value');
    const allSongs = snapshot.val();
    
    if (!allSongs) {
      console.log('No songs found in database.');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    const updatedSongs = [];
    
    // Iterate through all songs
    for (const [songId, song] of Object.entries(allSongs)) {
      if (!song || !song.artist) {
        skippedCount++;
        continue;
      }
      
      const artist = song.artist.trim();
      
      // Check if artist matches pattern "Ministério de Louvor" followed by number, dash, and album name
      // Pattern: "Ministério de Louvor" + number + " - " + album name
      const match = artist.match(/^ministério\s+de\s+louvor\s+\d+\s*-\s*(.+)$/i);
      
      if (match) {
        const album = match[1].trim();
        
        // If album is empty, skip this song
        if (!album) {
          console.log(`Skipping "${song.title}" - no album name found after "Ministério de Louvor"`);
          skippedCount++;
          continue;
        }
        
        console.log(`Found song: "${song.title}" (ID: ${songId})`);
        console.log(`  Current artist: "${song.artist}"`);
        console.log(`  Current album: ${song.album || '(none)'}`);
        console.log(`  Extracted album: "${album}"`);
        
        // Prepare update
        const updates = {
          artist: 'Ministério de Louvor',
          album: album,
          updatedAt: admin.database.ServerValue.TIMESTAMP
        };
        
        // Update the song
        const songRef = db.ref(`songs/${songId}`);
        await songRef.update(updates);
        
        updatedCount++;
        updatedSongs.push({
          id: songId,
          title: song.title,
          oldArtist: song.artist,
          newArtist: 'Ministério de Louvor',
          album: album
        });
        
        console.log(`  ✓ Updated to artist: "Ministério de Louvor", album: "${album}"`);
        console.log('');
      } else {
        skippedCount++;
      }
    }
    
    console.log('---');
    console.log(`Update completed!`);
    console.log(`  Updated: ${updatedCount} song(s)`);
    console.log(`  Skipped: ${skippedCount} song(s)`);
    
    if (updatedSongs.length > 0) {
      console.log('\nUpdated songs:');
      updatedSongs.forEach(song => {
        console.log(`  - "${song.title}" (${song.id})`);
        console.log(`    ${song.oldArtist} -> Ministério de Louvor / ${song.album}`);
      });
    }
    
  } catch (error) {
    console.error('Error during update:', error);
    throw error;
  }
}

/**
 * Main function to run the update
 */
async function main() {
  try {
    // Update songs with artist "Adoradores 3" to "Adoradores" with album "Adoradores 3"
    await updateSongDetails('Adoradores 3', 'Adoradores', 'Adoradores 3');
    
    // Update songs with artist "Adoradores 4" to "Adoradores" with album "Adoradores 4"
    await updateSongDetails('Adoradores 4', 'Adoradores', 'Adoradores 4');
    
    // Update songs with artist starting with "CD Jovem"
    await updateCDJovemSongs();
    
    // Update songs with artist containing "Celebra São Paulo Vol"
    await updateCelebraSaoPauloSongs();
    
    // Update songs with artist "Novo Hinário" or "Antigo Hinário"
    await updateHinarioSongs();
    
    // Update songs with artist containing "Ministério de Louvor"
    await updateMinisterioDeLouvorSongs();
    
    console.log('\n✓ All updates completed successfully!');
  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  } finally {
    // Clean up
    await admin.app().delete();
  }
}

// Run the script
if (require.main === module) {
  main();
}

// Export for use as a module
module.exports = { updateSongDetails, updateCDJovemSongs, updateCelebraSaoPauloSongs, updateHinarioSongs, updateMinisterioDeLouvorSongs };

