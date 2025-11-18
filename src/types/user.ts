export interface User {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  preferences: UserPreferences;
  stats: UserStats;
  createdAt: Date;
  lastActiveAt: Date;
  emailVerified: boolean;
}

export interface FilterState {
  searchQuery: string;
  selectedArtists: string[];
  selectedAlbums: string[];
  showFavoritesOnly: boolean;
  hasTracks: boolean;
  hasLyrics: boolean;
  hasScores: boolean;
  hasLinks: boolean;
  sortOrder: 'asc' | 'desc';
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  defaultPlaybackSpeed: number;
  autoPlay: boolean;
  language: string;
  defaultTab?: 'lyrics' | 'score' | 'tracks' | 'resources';
  filters: FilterState;
}

export interface UserStats {
  totalSessions: number;
  totalPlayTime: number; // in minutes
  joinedDate: Date;
  lastSessionDate?: Date;
  favoriteArtists: string[];
  favoriteSongs: string[];
}

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface SignupForm {
  email: string;
  password: string;
  displayName: string;
}

export interface ProfileUpdateForm {
  displayName?: string;
  avatar?: string;
  preferences?: Partial<UserPreferences>;
}

export interface PasswordResetForm {
  email: string;
}

export interface PasswordResetConfirmForm {
  code: string;
  newPassword: string;
  confirmPassword: string;
}

