export interface Song {
  id: string;
  title: string;
  artist: string;
  tracks?: Track[];
  lyrics?: string;
  scores?: Score[];
  resources?: Resource[];
  tenantId?: string;
  organizationId?: string;
  accessLevel?: 'public' | 'private' | 'restricted';
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
  type: 'youtube' | 'download' | 'link' | 'pdf';
  url: string;
  description?: string;
}

export interface Resource {
  id: string;
  name: string;
  type: 'youtube' | 'download' | 'link' | 'pdf';
  url: string;
  description?: string;
}
