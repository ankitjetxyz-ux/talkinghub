export type MessageAuthor = "me" | "them";

export interface Message {
  id: string;
  author: MessageAuthor;
  text: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  name: string;
  handle: string;
  status: "stable" | "drifting" | "silent";
  lastSeen: string;
  preview: string;
}
