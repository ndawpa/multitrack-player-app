const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://multitrack-player-app-default-rtdb.firebaseio.com",
  storageBucket: "multitrack-player-app.firebasestorage.app"
});

const db = admin.database();

// Define the songs to migrate
const songs = [
  {
    id: '1',
    title: 'Chegou a Hora',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '1-1',
        name: '1 Tenor',
        path: 'audio/chegou_a_hora/Chegou a Hora - 1 Tenor.mp3'
      },
      {
        id: '1-2',
        name: '2 Tenor',
        path: 'audio/chegou_a_hora/Chegou a Hora - 2 Tenor.mp3'
      },
      {
        id: '1-3',
        name: 'Barítono',
        path: 'audio/chegou_a_hora/Chegou a Hora - Barítono.mp3'
      },
      {
        id: '1-4',
        name: 'Baixo',
        path: 'audio/chegou_a_hora/Chegou a Hora - Baixo.mp3'
      },
      {
        id: '1-5',
        name: 'Original',
        path: 'audio/chegou_a_hora/Chegou a Hora - Original.mp3'
      },
      {
        id: '1-6',
        name: 'Playback',
        path: 'audio/chegou_a_hora/Chegou a Hora - Playback.mp3'
      }
    ]
  },
  {
    id: '2',
    title: 'Jesus de Nazaré',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '2-1',
        name: '1 Tenor',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - 1 Tenor.mp3'
      },
      {
        id: '2-2',
        name: '2 Tenor',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - 2 Tenor.mp3'
      },
      {
        id: '2-3',
        name: 'Barítono',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - Barítono.mp3'
      },
      {
        id: '2-4',
        name: 'Baixo',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - Baixo.mp3'
      },
      {
        id: '2-5',
        name: 'Original',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - Cantado.mp3'
      },
      {
        id: '2-6',
        name: 'Playback',
        path: 'audio/jesus_de_nazare/Jesus de Nazaré - Playback.mp3'
      }
    ]
  },
  {
    id: '3',
    title: 'Se Ele Não For o Primeiro',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '3-1',
        name: '1 Tenor',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - 1 Tenor.mp3'
      },
      {
        id: '3-2',
        name: '2 Tenor',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - 2 Tenor.mp3'
      },
      {
        id: '3-3',
        name: 'Barítono',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - Barítono.mp3'
      },
      {
        id: '3-4',
        name: 'Baixo',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - Baixo.mp3'
      },
      {
        id: '3-5',
        name: 'Original',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - Cantado.mp3'
      },
      {
        id: '3-6',
        name: 'Playback',
        path: 'audio/se_ele_nao_for_o_primeiro/Se Ele Não For O Primeiro - Playback.mp3'
      }
    ]
  },
  {
    id: '4',
    title: 'Eu Quero Amá-Lo Mais',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '4-1',
        name: '1 Tenor',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - 1 Tenor.mp3'
      },
      {
        id: '4-2',
        name: '2 Tenor',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - 2 Tenor.mp3'
      },
      {
        id: '4-3',
        name: 'Barítono',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - Barítono.mp3'
      },
      {
        id: '4-4',
        name: 'Baixo',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - Baixo.mp3'
      },
      {
        id: '4-5',
        name: 'Original',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-lo Mais - Cantado.mp3'
      },
      {
        id: '4-6',
        name: 'Playback',
        path: 'audio/eu_quero_ama_lo_mais/Eu Quero Amá-Lo Mais - Playback.mp3'
      }
    ]
  },
  {
    id: '5',
    title: 'O Nome Cristo',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '5-1',
        name: '1 Tenor',
        path: 'audio/o_nome_cristo/O Nome Cristo - 1 Tenor.mp3'
      },
      {
        id: '5-2',
        name: '2 Tenor',
        path: 'audio/o_nome_cristo/O Nome Cristo - 2 Tenor.mp3'
      },
      {
        id: '5-3',
        name: 'Barítono',
        path: 'audio/o_nome_cristo/O Nome Cristo - Barítono.mp3'
      },
      {
        id: '5-4',
        name: 'Baixo',
        path: 'audio/o_nome_cristo/O Nome Cristo - Baixo.mp3'
      },
      {
        id: '5-5',
        name: 'Original',
        path: 'audio/o_nome_cristo/O Nome Cristo - Cantado.mp3'
      },
      {
        id: '5-6',
        name: 'Playback',
        path: 'audio/o_nome_cristo/O Nome Cristo - Playback.mp3'
      }
    ]
  },
  {
    id: '6',
    title: 'Começando Aqui',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '6-1',
        name: '1 Tenor',
        path: 'audio/comecando_aqui/Começando Aqui - 1 Tenor.mp3'
      },
      {
        id: '6-2',
        name: '2 Tenor',
        path: 'audio/comecando_aqui/Começando Aqui - 2 Tenor.mp3'
      },
      {
        id: '6-3',
        name: 'Barítono',
        path: 'audio/comecando_aqui/Começando Aqui - Barítono.mp3'
      },
      {
        id: '6-4',
        name: 'Baixo',
        path: 'audio/comecando_aqui/Começando Aqui - Baixo.mp3'
      },
      {
        id: '6-5',
        name: 'Original',
        path: 'audio/comecando_aqui/Começando Aqui - Cantado.mp3'
      },
      {
        id: '6-6',
        name: 'Playback',
        path: 'audio/comecando_aqui/Começando Aqui - Playback.mp3'
      }
    ]
  },
  {
    id: '7',
    title: 'Vaso de Alabastro',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '7-1',
        name: '1 Tenor',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - 1 Tenor.mp3'
      },
      {
        id: '7-2',
        name: '2 Tenor',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - 2 Tenor.mp3'
      },
      {
        id: '7-3',
        name: 'Barítono',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - Barítono.mp3'
      },
      {
        id: '7-4',
        name: 'Baixo',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - Baixo.mp3'
      },
      {
        id: '7-5',
        name: 'Original',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - Cantado.mp3'
      },
      {
        id: '7-6',
        name: 'Playback',
        path: 'audio/vaso_de_alabastro/Vaso de Alabastro - Playback.mp3'
      }
    ]
  },
  {
    id: '8',
    title: 'Vem a Mim',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '8-1',
        name: '1 Tenor',
        path: 'audio/vem_a_mim/Vem a Mim - 1 Tenor.mp3'
      },
      {
        id: '8-2',
        name: '2 Tenor',
        path: 'audio/vem_a_mim/Vem a Mim - 2 Tenor.mp3'
      },
      {
        id: '8-3',
        name: 'Barítono',
        path: 'audio/vem_a_mim/Vem a Mim - Barítono.mp3'
      },
      {
        id: '8-4',
        name: 'Baixo',
        path: 'audio/vem_a_mim/Vem a Mim - Baixo.mp3'
      },
      {
        id: '8-5',
        name: 'Original',
        path: 'audio/vem_a_mim/Vem a Mim - Cantado.mp3'
      },
      {
        id: '8-6',
        name: 'Playback',
        path: 'audio/vem_a_mim/Vem a Mim - Playback.mp3'
      }
    ]
  },
  {
    id: '9',
    title: 'Eu Sei de Um Rio',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '9-1',
        name: '1 Tenor',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - 1 Tenor.mp3'
      },
      {
        id: '9-2',
        name: '2 Tenor',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - 2 Tenor.mp3'
      },
      {
        id: '9-3',
        name: 'Barítono',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - Barítono.mp3'
      },
      {
        id: '9-4',
        name: 'Baixo',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - Baixo.mp3'
      },
      {
        id: '9-5',
        name: 'Original',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de um Rio - Cantado.mp3'
      },
      {
        id: '9-6',
        name: 'Playback',
        path: 'audio/eu_sei_de_um_rio/Eu Sei de Um Rio - Playback.mp3'
      }
    ]
  },
  {
    id: '10',
    title: 'Eu Não Sou Mais Eu',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '10-1',
        name: '1 Tenor',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - 1 Tenor.mp3'
      },
      {
        id: '10-2',
        name: '2 Tenor',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - 2 Tenor.mp3'
      },
      {
        id: '10-3',
        name: 'Barítono',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - Barítono.mp3'
      },
      {
        id: '10-4',
        name: 'Baixo',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - Baixo.mp3'
      },
      {
        id: '10-5',
        name: 'Original',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - Cantado.mp3'
      },
      {
        id: '10-6',
        name: 'Playback',
        path: 'audio/eu_nao_sou_mais_eu/Eu Não Sou Mais Eu - Playback.mp3'
      }
    ]
  },
  {
    id: '11',
    title: 'Por Quê ó Pai?',
    artist: 'Arautos do Rei',
    tracks: [
      {
        id: '11-1',
        name: '1 Tenor',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - 1 Tenor.mp3'
      },
      {
        id: '11-2',
        name: '2 Tenor',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - 2 Tenor.mp3'
      },
      {
        id: '11-3',
        name: 'Barítono',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - Barítono.mp3'
      },
      {
        id: '11-4',
        name: 'Baixo',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - Baixo.mp3'
      },
      {
        id: '11-5',
        name: 'Original',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - Cantado.mp3'
      },
      {
        id: '11-6',
        name: 'Playback',
        path: 'audio/por_que_o_pai/Por Que, Ó Pai - Playback.mp3'
      }
    ]
  }
];

// Function to migrate songs to Firebase
async function migrateSongs() {
  try {
    console.log('Starting song migration...');
    
    // Create a reference to the songs node
    const songsRef = db.ref('songs');
    
    // Migrate each song
    for (const song of songs) {
      console.log(`Migrating song: ${song.title}`);
      
      // Create a new reference for this song
      const songRef = songsRef.child(song.id);
      
      // Upload the song data
      await songRef.set({
        title: song.title,
        artist: song.artist,
        tracks: song.tracks
      });
      
      console.log(`Successfully migrated: ${song.title}`);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Clean up
    admin.app().delete();
  }
}

// Run the migration
migrateSongs(); 