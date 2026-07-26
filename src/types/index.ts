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
  description: string;
  author: LinkResource;
  platform: GamePlatform;
  tags: GameTags;
  duration: string;
  answer: LinkResource; // Guide
  coverImage: string;
}

/** 社区投稿记录（独立表 game_submissions） */
export interface GameSubmission {
  id: number;
  title: string;
  url: string;
  description: string;
  image_url: string | null;
  duration: string;
  author_name: string;
  author_url: string;
  answer_url: string | null;
  pc: boolean;
  pe: boolean;
  jumpscare: boolean;
  sound: boolean;
  submitted_by: string;
  status: '审核中' | '已通过' | '已驳回';
  review_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Feedback {
  id: number;
  detective_name: string;
  intel_content: string;
  reply_content?: string;
  created_at: string;
  user_id?: string; // 新增：发送者的用户 ID
}
