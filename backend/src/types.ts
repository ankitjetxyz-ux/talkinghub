export type UserStatus = "stable" | "drifting" | "silent";

export interface Profile {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  status: UserStatus;
  created_at: string;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  created_by: string | null;
  created_at: string;
  last_message_at: string;
}

export interface MessageReaction {
  user_id: string;
  emoji: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  original_message: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  /** Hydrated when reading message lists — empty array if none */
  reactions?: MessageReaction[];
}

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
