import {
  Database,
  PreparedStatement,
  Row,
} from "https://deno.land/x/sqlite3@0.3.0/mod.ts";

export class TypedQuery<I extends unknown[], O extends unknown[]> {
  #statement: PreparedStatement;
  constructor(statement: PreparedStatement) {
    this.#statement = statement;
  }

  one(...inputs: I): O {
    console.log(inputs);
    this.#statement.reset();
    for (let i = 0; i < inputs.length; i++) {
      this.#statement.bind(i + 1, inputs[i]);
    }
    return this.#statement.step()?.asArray() ?? [] as unknown as O;
  }

  *query(...inputs: I): Generator<O> {
    this.#statement.reset();
    for (let i = 0; i < inputs.length; i++) {
      this.#statement.bind(i + 1, inputs[i]);
    }
    let row: Row | undefined;
    while (row = this.#statement.step()) {
      yield row.asArray();
    }
  }
}

export default class TypedDatabase extends Database {
  prepareTyped<I extends unknown[], O extends unknown[]>(
    sql: string,
  ): TypedQuery<I, O> {
    return new TypedQuery(this.prepare(sql));
  }
}
