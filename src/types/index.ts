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
  status: string; // "是" = active, "审核中" = pending, "已驳回" = rejected
  description: string;
  author: LinkResource;
  platform: GamePlatform;
  tags: GameTags;
  duration: string;
  answer: LinkResource; // Guide
  coverImage: string;
  submitted_by?: string; // UUID of submitter (from auth.users)
  review_comment?: string; // 审核不通过原因
}

export interface Feedback {
  id: number;
  detective_name: string;
  intel_content: string;
  reply_content?: string;
  created_at: string;
  user_id?: string; // 新增：发送者的用户 ID
}
