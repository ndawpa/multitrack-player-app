export interface Playlist {
  id: string;
  name: string;
  description?: string;
  userId: string;
  songs: PlaylistItem[];
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  playCount: number;
  lastPlayedAt?: Date;
}

export interface PlaylistItem {
  id: string;
  songId: string;
  songTitle: string;
  songArtist: string;
  position: number; // Order in playlist (0-based)
  addedAt: Date;
  // Optional: user can add notes for each song in playlist
  notes?: string;
}

export interface CreatePlaylistForm {
  name: string;
  description?: string;
  isPublic: boolean;
}

export interface UpdatePlaylistForm {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

export interface AddSongToPlaylistForm {
  songId: string;
  position?: number; // If not provided, adds to end
  notes?: string;
}

export interface ReorderPlaylistForm {
  songId: string;
  newPosition: number;
}
