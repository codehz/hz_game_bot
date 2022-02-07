import * as YAML from "https://deno.land/std@0.123.0/encoding/yaml.ts";
import { Row } from "https://deno.land/x/sqlite3@0.3.0/mod.ts";
import Database, { TypedQuery } from "./db.ts";

export type Secret = {
  token: string;
};

export type Config = {
  hostnames: string[];
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

db.execute(`create table if not exists session_raw (
  game text not null,
  inline_message_id text not null,
  chat_id integer not null,
  message_id integer not null,
  unique(game, inline_message_id, chat_id, message_id)
)`);

db.execute(`create table if not exists user_cache (
  id integer primary key,
  first_name text not null,
  last_name text,
  username text,
  language_code text
) without rowid`);

db.execute(`create table if not exists log (
  session_id integer not null,
  time integer not null,
  user_id integer not null,
  score integer not null
)`);

db.execute(`create view if not exists log_view as
  select
    session.game,
    session.inline_message_id,
    session.chat_id,
    session.message_id,
    log.*
  from log
  join session on session.rowid = log.session_id`);

db.execute(`create view if not exists session (
  rowid,
  game,
  inline_message_id,
  chat_id,
  message_id
) as select
  rowid,
  game,
  iif(inline_message_id == '', null, inline_message_id),
  iif(chat_id == -1, null, chat_id),
  iif(message_id == -1, null, message_id)
from session_raw`);

db.execute(`create table if not exists blocklist (
  user_id integer primary key,
  desc text not null
) without rowid`);

console.log("config loaded");

export function transaction<R>(f: () => R): R {
  db.execute("BEGIN IMMEDIATE TRANSACTION");
  try {
    const ret = f();
    db.execute("COMMIT TRANSACTION");
    return ret;
  } catch (e) {
    db.execute("ROLLBACK TRANSACTION");
    throw e;
  }
}

export const addToUserCacheSql = db.prepareTyped<
  [number, string, string | undefined, string | undefined, string | undefined],
  []
>(`replace into user_cache values (?, ?, ?, ?, ?)`);

export function addToUserCache(
  { id, first_name, last_name, username, language_code }: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  },
) {
  addToUserCacheSql.one(id, first_name, last_name, username, language_code);
}

export const fetchUser = db.prepareTyped<
  [number],
  [number, string, string | undefined, string | undefined, string | undefined]
>(`select * from user_cache where id = ?`);

export const isBlocked = db.prepareTyped<[number], [number]>(
  "select count(*) from blocklist where user_id = ?",
);

export const addToBlockList = db.prepareTyped<[number, string], []>(
  `insert into blocklist values (?1, ?2) on conflict do update set desc = ?2`,
);

export const removeFromBlocklist = db.prepareTyped<[number], []>(
  `delete from blocklist where user_id = ?`,
);

export const listBlockList = db.prepareTyped<[number], [number, string]>(
  "select user_id, desc from blocklist limit 100 offset ?",
);

export const createSessionIfNeeded = db.prepareTyped<
  [string, string | undefined, number | undefined, number | undefined],
  [number]
>(
  `insert into session_raw values (
    ?1,
    iif(?2 is null, '', ?2),
    iif(?3 is null, -1, ?3),
    iif(?4 is null, -1, ?4)
  ) on conflict do update set game=?1 returning rowid`,
);

export const listSession = db.prepareTyped<
  [],
  [
    number,
    string,
    string | undefined,
    number | undefined,
    number | undefined,
  ]
>("select rowid, * from session");

export const fetchSession = db.prepareTyped<
  [number],
  [number, string, string | undefined, number | undefined, number | undefined]
>("select * from session where rowid = ?");

export const addLog = db.prepareTyped<
  [number, number, number, number],
  [number]
>(
  `insert into log values (?, ?, ?, ?) returning rowid`,
);

export function* queryLog(
  { page, session, user, min_time, max_time, min_score, max_score }: {
    page: number;
    session?: number;
    user?: number;
    min_time?: number;
    max_time?: number;
    min_score?: number;
    max_score?: number;
  },
): Generator<
  [
    string,
    string | undefined,
    number | undefined,
    number | undefined,
    number,
    number,
    number,
    number,
  ]
> {
  let str = "";
  const arr = [];
  if (session) {
    str += ` and session_id = ?`;
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
    str += ` and time <= ?`;
    arr.push(max_time);
  }
  if (min_score) {
    str += ` and score >= ?`;
    arr.push(min_score);
  }
  if (max_score) {
    str += ` and score <= ?`;
    arr.push(max_score);
  }
  arr.push(page * 100);
  const statement = db.prepare(
    `select * from log_view where 1 = 1${str} order by time desc limit 100 offset ?`,
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
  [
    number,
    string,
    string | undefined,
    number | undefined,
    number | undefined,
    number,
  ]
>(
  "select * from session where rowid in (select distinct session_id from log where user_id = ?)",
);
