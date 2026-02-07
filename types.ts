export interface GamePlatform {
  pc: boolean;
  pe: boolean; // Mobile
}

export interface GameTags {
  hasJumpScare: boolean;
  hasSound: boolean;
}

export interface LinkResource {
  text: string;
  url: string;
}

export interface GameData {
  id: string;
  title: string;
  url: string;
  releaseDate: string;
  status: string; // "是" for active
  description: string;
  author: LinkResource;
  platform: GamePlatform;
  tags: GameTags;
  duration: string;
  answer: LinkResource; // Guide
  coverImage: string;
}