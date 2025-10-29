export interface Song {
  id: string;
  title: string;
  artist: string;
  tracks?: Track[];
  lyrics?: string;
  scores?: Score[];
  resources?: Resource[];
  accessControl?: {
    allowedUsers?: string[];
    allowedGroups?: string[];
    visibility: 'public' | 'private' | 'group_restricted';
    accessLevel: 'read' | 'play' | 'download' | 'edit';
  };
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

export interface Track {
  id: string;
  name: string;
  path: string;
}

export interface Score {
  id: string;
  name: string;
  url: string;
}

export interface Resource {
  id: string;
  name: string;
  type: 'youtube' | 'download' | 'link' | 'pdf';
  url: string;
  description?: string;
}
