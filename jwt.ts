import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v2.4/mod.ts";

const key = await crypto.subtle.generateKey(
  { name: "HMAC", hash: "SHA-512" },
  true,
  ["sign", "verify"],
);

export function encode<T extends Record<string, any>>(
  data: T,
  exp: number = 60 * 60 * 24,
) {
  return create(
    { alg: "HS512", typ: "JWT" },
    Object.assign({}, data, { exp: getNumericDate(exp) }),
    key,
  );
}

export async function decode<T extends Record<string, any>>(jwt: string) {
  return verify(jwt, key) as Promise<T>
}
