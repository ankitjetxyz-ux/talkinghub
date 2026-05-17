export type UserStatus = "stable" | "drifting" | "silent";

export interface Profile {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  status: UserStatus;
  profile_setup_completed: boolean;
  created_at: string;
}

export interface DbMessageReaction {
  user_id: string;
  emoji: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  original_message: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  reactions?: DbMessageReaction[];
}

export interface ConversationListItem {
  id: string;
  is_group: boolean;
  name: string | null;
  last_message_at: string;
  other: Profile | null;
  preview: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface Session {
  access_token: string;
  user: AuthUser;
}
