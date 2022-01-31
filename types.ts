export type Payload = {
  game: string;
  user_id: number;
} & ({ inline_message_id: string, chat_id: undefined; message_id: undefined } | { inline_message_id: undefined, chat_id: number; message_id: number });
