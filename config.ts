import * as YAML from "https://deno.land/std@0.123.0/encoding/yaml.ts";
import { Row } from "https://deno.land/x/sqlite3@0.3.0/mod.ts";
import Database, { TypedQuery } from "./db.ts";

export type Secret = {
  token: string;
};

export type Config = {
  base: string;
  static: string;
  port: number;
  db: string;
  admins: number[];
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

export function isAdmin(id: number) {
  return config.admins.includes(id);
}

db.execute("pragma journal_mode=wal");

db.execute(`create table if not exists session (
  game text not null,
  inline_message_id text,
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

db.execute(
  `create unique index if not exists uniq_blocklist on blocklist (user_id)`,
);

console.log("config loaded");

export const isBlocked = db.prepareTyped<[number], [number]>(
  "select count(*) from blocklist where user_id = ?",
);

export const addToBlockList = db.prepareTyped<[number, string], [number]>(
  `insert into blocklist values (?1, ?2)
  on conflict do update set desc = ?2
  returning rowid`,
);

export const listBlockList = db.prepareTyped<[number], [number, string]>(
  "select user_id, desc from blocklist limit 100 offset ?",
);

export const createSessionIfNeeded = db.prepareTyped<
  [string, string | undefined, number | undefined, number | undefined],
  [number]
>(
  `insert into session values (?, ?, ?, ?, 1) on conflict do update set count=count+1 returning rowid`,
);

export const listSession = db.prepareTyped<
  [],
  [
    number,
    string,
    string | undefined,
    number | undefined,
    number | undefined,
    number,
  ]
>("select rowid, * from session");

export const fetchSession = db.prepareTyped<
  [number],
  [string, string | undefined, number | undefined, number | undefined, number]
>("select * from session where rowid = ?");

export const addLog = db.prepareTyped<
  [number, number, number, number],
  [number]
>(
  `insert into log values (?, ?, ?, ?) returning rowid`,
);

export function* queryLog({ page, session, user, min_time, max_time }: {
  page: number;
  session?: number;
  user?: number;
  min_time?: number;
  max_time?: number;
}): Generator<[number, number, number, number]> {
  let str = "";
  const arr = [];
  if (session) {
    str += ` and id = ?`;
    arr.push(session);
  }
  if (user) {
    str += ` and user_id = ?`;
    arr.push(user);
  }
  if (min_time) {
    str += ` and time >= ?`;
    arr.push(min_time);
  }
  if (max_time) {
    str += ` and time >= ?`;
    arr.push(max_time);
  }
  arr.push(page * 100);
  const statement = db.prepare(
    `select * from log where 1 = 1${str} order by time desc limit 100 offset ?`,
  );
  try {
    statement.bindAll(...arr);
    let step: Row | undefined;
    while (step = statement.step()) {
      yield step.asArray();
    }
  } finally {
    statement.reset();
    statement.finalize();
  }
}

export const querySessionForUser = db.prepareTyped<
  [number],
  [string, string | undefined, number | undefined, number | undefined, number]
>(
  "select * from session where rowid in (select distinct id from log where user_id = ?)",
);
