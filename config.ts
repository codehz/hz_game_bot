import * as YAML from "https://deno.land/std@0.123.0/encoding/yaml.ts";

export type Secret = {
  token: string;
}

export type Config = {
  base: string;
  static: string;
  games: Array<{
    name: string;
    id: string;
  }>
}

export const secret = YAML.parse(await Deno.readTextFile("./secret.yaml")) as Secret;
export const config = YAML.parse(await Deno.readTextFile("./config.yaml")) as Config;
