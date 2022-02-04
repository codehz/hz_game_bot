import * as YAML from "https://deno.land/std@0.123.0/encoding/yaml.ts";
import { Database } from "https://deno.land/x/sqlite3@0.3.0/mod.ts";

export type Secret = {
  token: string;
};

export type Config = {
  base: string;
  static: string;
  port: number;
  db: string;
  admin: number;
  api?: string;
  games: Array<{
    name: string;
    id: string;
  }>;
};

export const secret = YAML.parse(
  await Deno.readTextFile("./secret.yaml"),
) as Secret;
export const config = YAML.parse(
  await Deno.readTextFile("./config.yaml"),
) as Config;

export const db = new Database(config.db);

db.execute("begin");

db.execute(`create table if not exists session (
  game text not null,
  inline_message_id integer,
  chat_id integer,
  message_id integer,
  count integer,
  unique(game, inline_message_id, chat_id, message_id)
)`);

db.execute(`create table if not exists log (
  id integer not null,
  time integer not null,
  user_id integer not null,
  score integer not null
)`);

db.execute(`create table if not exists blocklist (
  user_id integer not null,
  desc text
)`);

db.execute("commit");

console.log("here");

export const isBlocked = db.prepare(
  "select count(*) from blocklist where user_id = ?",
);

export const addToBlockList = db.prepare(
  "insert into blocklist values (?, ?)",
);

export const listBlockList = db.prepare(
  "select user_id, desc from blocklist",
);

export const createSessionIfNeeded = db.prepare(
  `insert into session values (?, ?, ?, ?, 1) on conflict do update set count=count+1 returning rowid`,
);

export const listSession = db.prepare("select * from session");

export const addLog = db.prepare(
  `insert into log values (?, ?, ?, ?)`,
);

export const listLog = db.prepare("select * from log limit 10 offset ?");
