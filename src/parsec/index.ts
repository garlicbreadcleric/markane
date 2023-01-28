export * from "./position";
export * from "./tokenizer";

import { everyPredicate, Predicate, somePredicate } from "../utils";
import { Token, TokenScope } from "./tokenizer";
import { Position, Range } from "./position";

export type ParserState = {
  readonly tokens: Token[];
  offset: number;
};

export enum ParserStatus {
  Ok = "Ok",
  Error = "Error",
}

export type ParserResultOk<T> = {
  status: ParserStatus.Ok;
  value: T;
  state: ParserState;
};

export type ParserResultErr = { status: ParserStatus.Error; message?: string };

export type ParserResult<T> = ParserResultOk<T> | ParserResultErr;

export type ParserFn<T> = (state: ParserState) => ParserResult<T>;

type ParserBindStmt<TScope, TValue> = Parser<TValue> | ((scope: TScope) => Parser<TValue>);

export class Parser<T> {
  constructor(public readonly run: ParserFn<T>, public readonly parserName: string | null = null) {}

  toString() {
    return this.parserName ?? "Parser";
  }

  withName(name: string): Parser<T> {
    return new Parser(this.run, name);
  }

  static lazy<T>(f: () => Parser<T>, parserName: string | null = null): Parser<T> {
    return new Parser<T>((state: ParserState) => f().run(state), parserName);
  }

  static pure<T>(value: T, parserName: string | null = null): Parser<T> {
    return new Parser((state: ParserState) => ({
      status: ParserStatus.Ok,
      value,
      state,
    }), parserName);
  }

  static fail<T>(message?: string, parserName: string | null = null): Parser<T> {
    return new Parser((_state: ParserState) => ({
      status: ParserStatus.Error,
      message,
    }), parserName);
  }

  parse(tokens: Token[]): T {
    const result = this.run({ tokens, offset: 0 });
    if (result.status === ParserStatus.Error) {
      throw new Error(result.message);
    }

    return result.value;
  }

  chain<T2>(f: (value: T) => Parser<T2>, parserName: string | null = null): Parser<T2> {
    return new Parser((state: ParserState) => {
      const result = this.run(state);
      if (result.status === ParserStatus.Ok) {
        return f(result.value).run(result.state);
      }
      return result;
    }, parserName);
  }

  map<T2>(f: (value: T) => T2, parserName: string | null = null): Parser<T2> {
    return this.chain((v) => Parser.pure(f(v)), parserName);
  }

  public bind<TName extends string, T2>(name: TName, s: ParserBindStmt<T, T2>): Parser<T & { [x in TName]: T2 }> {
    const f: (scope: T) => Parser<T2> = s instanceof Parser ? () => s : s;
    return this.chain((scope) => f(scope).map((value) => <any>Object.assign({ [name]: value }, scope)));
  }

  singleton(parserName: string | null = null): Parser<T[]> {
    return this.map((x) => [x], parserName);
  }

  try(parserName: string | null = null): Parser<T | null> {
    return tryOrNull(this, parserName);
  }

  tryWithDefault<TDefault>(def: TDefault, parserName: string | null = null): Parser<T | TDefault> {
    return tryOrDefault(this, def, parserName);
  }

  or<T2>(p: Parser<T2>, parserName: string | null = null): Parser<T | T2> {
    return or(this, p, parserName);
  }

  many(parserName: string | null = null): Parser<T[]> {
    return many(this, parserName);
  }

  many1(parserName: string | null = null): Parser<T[]> {
    return this.many().check((xs) => xs.length > 0, undefined, parserName);
  }

  manyWithComeback(comeback: Parser<any>, parserName: string | null = null): Parser<T[]> {
    return manyWithComeback(this, comeback, parserName);
  }

  check(pred: Predicate<T>, messageFn?: (t: T) => string, parserName: string | null = null): Parser<T> {
    return check(pred, messageFn, parserName)(this);
  }

  checkEvery(preds: Predicate<T>[], messageFn?: (t: T) => string, parserName: string | null = null): Parser<T> {
    return this.check(everyPredicate(...preds), messageFn, parserName);
  }

  checkSome(preds: Predicate<T>[], messageFn?: (t: T) => string, parserName: string | null = null): Parser<T> {
    return this.check(somePredicate(...preds), messageFn, parserName);
  }
}

export const init = Parser.pure({});

// class ScopedParserComputation<TScope, TValue> {
//   public constructor(public readonly parser: Parser<{ value: TValue; scope: TScope }>) {}

//   public static create<TScope = {}, TValue = null>(): ScopedParserComputation<{}, null>;
//   public static create<TScope, TValue>(scope: TScope, value: TValue): ScopedParserComputation<TScope, TValue>;

//   public static create<TScope, TValue>(scope?: TScope, value?: TValue): ScopedParserComputation<TScope, TValue> {
//     if (scope == null && value == null) {
//       return <any>new ScopedParserComputation(Parser.pure({ value: null, scope: {} }));
//     } else {
//       return new ScopedParserComputation(Parser.pure({ value: value!, scope: scope! }));
//     }
//   }

//   public get valueParser(): Parser<TValue> {
//     return this.parser.map(({ value }) => value);
//   }
//   public get scopeParser(): Parser<TScope> {
//     return this.parser.map(({ scope }) => scope);
//   }

//   public bind<TName extends string, TValue2>(
//     name: TName,
//     s: ScopedParserComputationStatement<TScope, TValue2>
//   ): ScopedParserComputation<TScope & { [x in TName]: TValue2 }, TValue2> {
//     const f: (scope: TScope) => Parser<TValue2> = s instanceof Parser ? () => s : s;

//     return new ScopedParserComputation(
//       this.parser.chain(({ scope }) =>
//         f(scope).map((value) => ({
//           value,
//           scope: <any>Object.assign({ [name]: value }, scope),
//         }))
//       )
//     );
//   }

//   public do<TValue2>(s: ScopedParserComputationStatement<TScope, TValue2>): ScopedParserComputation<TScope, TValue2> {
//     const f: (scope: TScope) => Parser<TValue2> = s instanceof Parser ? () => s : s;

//     return new ScopedParserComputation(
//       this.parser.chain(({ scope }) =>
//         f(scope).map((value) => ({
//           value,
//           scope,
//         }))
//       )
//     );
//   }
// }

// export const comp = ScopedParserComputation.create;

export const takeOne: Parser<Token> = new Parser((state: ParserState) => {
  if (state.offset < state.tokens.length) {
    return {
      status: ParserStatus.Ok,
      value: state.tokens[state.offset],
      state: {
        offset: state.offset + 1,
        tokens: state.tokens,
      },
    };
  }

  return {
    status: ParserStatus.Error,
    message: "Reached end of input while trying to get the next token.",
  };
});

export const eof: Parser<null> = new Parser((state: ParserState) => {
  if (state.offset < state.tokens.length) {
    return {
      status: ParserStatus.Error,
      message: `Expected end of input, instead got ${state.tokens[state.offset].content}`,
    };
  }

  return {
    status: ParserStatus.Ok,
    state,
    value: null,
  };
});

export function cond(pred: (token: Token) => boolean, errorMessage?: string): Parser<Token> {
  return takeOne.chain((t) => {
    if (pred(t)) {
      return Parser.pure(t);
    }
    return Parser.fail(errorMessage);
  });
}

export function tryOrNull<T>(p: Parser<T>, parserName: string | null = null): Parser<T | null> {
  return tryOrDefault(p, null, parserName);
}

export function tryOrDefault<T, TDefault>(p: Parser<T>, def: TDefault, parserName: string | null = null): Parser<T | TDefault> {
  return new Parser((state: ParserState): ParserResult<T | TDefault> => {
    const result = p.run(state);
    if (result.status === ParserStatus.Ok) {
      return result;
    }
    return {
      status: ParserStatus.Ok,
      state: state,
      value: def,
    };
  }, parserName);
}

export function oneOf<T>(parsers: Parser<T>[]): Parser<T> {
  if (parsers.length === 0) {
    throw new Error("Expected a non-empty list of parsers.");
  }

  return new Parser((state: ParserState): ParserResult<T> => {
    let result: ParserResult<T> | null = null;
    for (const p of parsers) {
      result = p.run(state);
      if (result.status === ParserStatus.Ok) {
        return result;
      }
    }
    return result!;
  });
}

export function or<T1, T2>(p1: Parser<T1>, p2: Parser<T2>, parserName: string | null = null): Parser<T1 | T2> {
  return new Parser((state: ParserState): ParserResult<T1 | T2> => {
    const r1 = p1.run(state);
    if (r1.status === ParserStatus.Ok) {
      return r1;
    }
    return p2.run(state);
  }, parserName ?? `${p1.toString()}|${p2.toString()}`);
}

export function takeWhile(pred: (token: Token) => boolean): Parser<Token[]> {
  return new Parser((state: ParserState) => {
    const result = [];
    let currentState = state;
    while (currentState.offset < currentState.tokens.length) {
      const currentToken = currentState.tokens[currentState.offset];
      if (pred(currentToken)) {
        result.push(currentToken);
        currentState = {
          tokens: currentState.tokens,
          offset: currentState.offset + 1,
        };
      } else {
        break;
      }
    }
    return {
      status: ParserStatus.Ok,
      value: result,
      state: currentState,
    };
  });
}

export function many<T>(p: Parser<T>, parserName: string | null = null): Parser<T[]> {
  return new Parser((state: ParserState) => {
    const result = [];
    let currentState = state;
    while (currentState.offset < currentState.tokens.length) {
      const currentResult = p.run(currentState);
      if (currentResult.status === ParserStatus.Error) {
        break;
      } else {
        result.push(currentResult.value);
        currentState = currentResult.state;
      }
    }
    return {
      status: ParserStatus.Ok,
      value: result,
      state: currentState,
    };
  }, parserName ?? `${p.toString()}*`);
}

export function manyWithComeback<T, TComeback>(p: Parser<T>, comeback: Parser<TComeback>, parserName: string | null = null) {
  return new Parser((state: ParserState) => {
    const result = [];
    let currentState = state;
    while (currentState.offset < currentState.tokens.length) {
      const currentResult = p.run(currentState);
      if (currentResult.status === ParserStatus.Error) {
        const comebackResult = comeback.run(currentState);
        if (comebackResult.status === ParserStatus.Error) {
          break;
        }
        currentState = comebackResult.state;
      } else {
        result.push(currentResult.value);
        currentState = currentResult.state;
      }
    }
    return {
      status: ParserStatus.Ok,
      value: result,
      state: currentState,
    };
  }, parserName);
}

export type WithAcc<TValue, TAcc> = {
  value: TValue;
  acc: TAcc;
};

export function manyWithAcc<TValue, TAcc>(
  p: Parser<TValue>,
  accFn: (value: TValue, acc: TAcc) => TAcc,
  initialAcc: TAcc
): Parser<WithAcc<TValue[], TAcc>> {
  return new Parser((state: ParserState) => {
    const result = [];
    let currentState = state;
    let currentAcc = initialAcc;
    while (currentState.offset < currentState.tokens.length) {
      const currentResult = p.run(currentState);
      if (currentResult.status === ParserStatus.Error) {
        break;
      } else {
        result.push(currentResult.value);
        currentState = currentResult.state;
        currentAcc = accFn(currentResult.value, currentAcc);
      }
    }
    return {
      status: ParserStatus.Ok,
      value: {
        value: result,
        acc: currentAcc,
      },
      state: currentState,
    };
  });
}

export function manyWithAccAndComeback<TValue, TComeback, TAcc>(
  p: Parser<TValue>,
  pc: Parser<TComeback>,
  accFn: (value: TValue, acc: TAcc) => TAcc,
  accComebackFn: (comebackValue: TComeback, acc: TAcc) => TAcc,
  initialAcc: TAcc
): Parser<WithAcc<TValue[], TAcc>> {
  return new Parser((state: ParserState) => {
    const result = [];
    let currentState = state;
    let currentAcc = initialAcc;
    while (currentState.offset < currentState.tokens.length) {
      const currentResult = p.run(currentState);
      if (currentResult.status === ParserStatus.Error) {
        const comebackResult = pc.run(currentState);
        if (comebackResult.status === ParserStatus.Error) {
          break;
        }
        currentState = comebackResult.state;
        currentAcc = accComebackFn(comebackResult.value, currentAcc);
      } else {
        result.push(currentResult.value);
        currentState = currentResult.state;
        currentAcc = accFn(currentResult.value, currentAcc);
      }
    }
    return {
      status: ParserStatus.Ok,
      value: {
        value: result,
        acc: currentAcc,
      },
      state: currentState,
    };
  });
}

export function join<TValue, TSep>(p: Parser<TValue>, pSep: Parser<TSep>): Parser<TValue[]> {
  return p.chain((v) =>
    pSep
      .chain(() => p)
      .many()
      .map((vs) => [v].concat(vs))
  );
}

export function seq<T>(parsers: Parser<T>[]): Parser<T[]> {
  return new Parser((state: ParserState) => {
    const result = [];
    let currentState = state;

    for (const parser of parsers) {
      const currentResult = parser.run(currentState);
      if (currentResult.status === ParserStatus.Error) {
        return currentResult;
      }
      result.push(currentResult.value);
      currentState = currentResult.state;
    }

    return {
      status: ParserStatus.Ok,
      value: result,
      state: currentState,
    };
  });
}

export function flatSeq<T>(parsers: Parser<T[]>[]): Parser<T[]> {
  return new Parser((state: ParserState) => {
    const result = [];
    let currentState = state;

    for (const parser of parsers) {
      const currentResult = parser.run(currentState);
      if (currentResult.status === ParserStatus.Error) {
        return currentResult;
      }
      for (const elem of currentResult.value) result.push(elem);
      currentState = currentResult.state;
    }

    return {
      status: ParserStatus.Ok,
      value: result,
      state: currentState,
    };
  });
}

export function check<T>(pred: (t: T) => boolean, messageFn?: (t: T) => string, parserName: string | null = null): (p: Parser<T>) => Parser<T> {
  return (p: Parser<T>) =>
    p.chain(
      (t) =>
        new Parser((s) => {
          if (pred(t))
            return {
              status: ParserStatus.Ok,
              state: s,
              value: t,
            };

          const result: ParserResultErr = { status: ParserStatus.Error };
          if (messageFn != null) {
            result.message = messageFn(t);
          }
          return result;
        }),
      parserName ?? p.parserName
    );
}

export function checkNonEmpty<T>(parser: Parser<T[]>): Parser<T[]> {
  return check((xs: T[]) => xs.length > 0)(parser);
}

export enum ScopedMode {
  And = "And",
  Or = "Or",
}

export function scoped(scopes: TokenScope | TokenScope[], mode: ScopedMode = ScopedMode.And) {
  return cond((t) => {
    if (!(scopes instanceof Array)) {
      scopes = [scopes];
    }
    if (mode === ScopedMode.And) {
      return scopes.every((s) => t.scopes.includes(s)); // TODO: Can do in one pass.
    }
    return scopes.some((s) => t.scopes.includes(s));
  });
}

export const currentRange: Parser<Range> = new Parser((state: ParserState) => {
  return takeOne
    .chain(
      (t) =>
        new Parser((_s) => ({
          status: ParserStatus.Ok,
          value: { start: t.start, end: t.end },
          state,
        }))
    )
    .run(state);
});

export const lastRange: Parser<Range> = new Parser((state: ParserState) => {
  if (state.offset === 0 || state.tokens.length === 0) {
    return {
      status: ParserStatus.Ok,
      state,
      value: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    };
  }

  const lastElement = state.tokens[state.offset - 1];
  return {
    status: ParserStatus.Ok,
    state,
    value: { start: lastElement.start, end: lastElement.end },
  };
});

export const currentStartPosition: Parser<Position> = currentRange.map((r) => r.start);
export const currentEndPosition: Parser<Position> = currentRange.map((r) => r.end);

export const lastStartPosition: Parser<Position> = lastRange.map((r) => r.start);
export const lastEndPosition: Parser<Position> = lastRange.map((r) => r.end);

export const currentStartLine: Parser<number> = currentStartPosition.map((p) => p.line);
export const currentStartCharacter: Parser<number> = currentStartPosition.map((p) => p.character);
export const currentEndLine: Parser<number> = currentEndPosition.map((p) => p.line);
export const currentEndCharacter: Parser<number> = currentEndPosition.map((p) => p.character);

export const lastStartLine: Parser<number> = lastStartPosition.map((p) => p.line);
export const lastStartCharacter: Parser<number> = lastStartPosition.map((p) => p.character);
export const lastEndLine: Parser<number> = lastEndPosition.map((p) => p.line);
export const lastEndCharacter: Parser<number> = lastEndPosition.map((p) => p.character);
