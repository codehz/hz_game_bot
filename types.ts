export type Payload = {
  game: string;
  user_id: number;
  inline_message_id?: string;
  chat_id?: number;
  message_id?: number;
  is_admin: boolean;
};

export type AdminPayload = {
  user_id: number;
  user_name: string;
}