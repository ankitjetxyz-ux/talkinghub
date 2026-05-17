export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      conversation_members: {
        Row: {
          conversation_id: string;
          joined_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          joined_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          joined_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_group: boolean;
          last_message_at: string;
          name: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_group?: boolean;
          last_message_at?: string;
          name?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_group?: boolean;
          last_message_at?: string;
          name?: string | null;
        };
        Relationships: [];
      };
      message_reactions: {
        Row: {
          emoji: string;
          created_at: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          emoji: string;
          created_at?: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          emoji?: string;
          created_at?: string;
          message_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          media_type: string | null;
          media_url: string | null;
          original_message: string;
          sender_id: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          media_type?: string | null;
          media_url?: string | null;
          original_message: string;
          sender_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          media_type?: string | null;
          media_url?: string | null;
          original_message?: string;
          sender_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          handle: string;
          id: string;
          profile_setup_completed: boolean;
          status: Database["public"]["Enums"]["user_status"];
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          handle: string;
          id: string;
          profile_setup_completed?: boolean;
          status?: Database["public"]["Enums"]["user_status"];
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          handle?: string;
          id?: string;
          profile_setup_completed?: boolean;
          status?: Database["public"]["Enums"]["user_status"];
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      archive_delete_message: { Args: { p_message_id: string }; Returns: undefined };
      archive_ensure_profile: { Args: Record<string, never>; Returns: Database["public"]["Tables"]["profiles"]["Row"] };
      archive_send_message: {
        Args: {
          conv_id: string;
          p_plain: string;
          p_media_url?: string | null;
          p_media_type?: string | null;
        };
        Returns: Database["public"]["Tables"]["messages"]["Row"];
      };
      archive_start_dm: { Args: { _handle: string }; Returns: string };
      archive_toggle_reaction: {
        Args: { p_message_id: string; p_emoji: string };
        Returns: Json;
      };
    };
    Enums: {
      user_status: "stable" | "drifting" | "silent";
    };
  };
};

type DefaultSchema = Database["public"];

export type Tables<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName]["Row"];
