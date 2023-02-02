import fs from "fs";
import path from "path";

import * as vsctm from "vscode-textmate";
import * as oniguruma from "vscode-oniguruma";

import { everyPredicate, Predicate, readFile } from "../utils";
import { Position, Range } from "./position";

export type TokenScope = string;

export type HasRange = {
  start: Position;
  end: Position;
};

export type HasRangeAndContent = HasRange & {
  content: string;
};

export type Token = HasRangeAndContent & {
  scopes: TokenScope[];
};

export function getTokensRange(tokens: HasRangeAndContent[]): Range | null {
  if (tokens.length === 0) return null;

  return { start: tokens[0].start, end: tokens[tokens.length - 1].end };
}

export function getTokensContent(tokens: HasRangeAndContent[]): string {
  if (tokens.length === 0) return "";

  let result = "";
  let lastLine = tokens[0].start.line;

  for (const token of tokens) {
    if (token.start.line > lastLine) {
      result += "\n".repeat(token.start.line - lastLine);
    }
    result += token.content;
    lastLine = token.end.line;
  }

  return result;
}

export function startsOnLine(l: number): Predicate<HasRange> {
  return (t) => t.start.line === l;
}

export function endsOnLine(l: number): Predicate<HasRange> {
  return (t) => t.end.line === l;
}

export function withinLine(l: number): Predicate<HasRange> {
  return everyPredicate(startsOnLine(l), endsOnLine(l));
}

export function hasScope(scope: TokenScope): Predicate<Token> {
  return (t) => t.scopes.includes(scope);
}

export class Tokenizer {
  protected registry: vsctm.Registry;
  protected grammars: Map<string, vsctm.IGrammar> = new Map();

  constructor() {
    const self = this;
    const wasmBin = fs.readFileSync(
      path.join(__dirname, "../../node_modules/vscode-oniguruma/release/onig.wasm")
    ).buffer;

    const vscodeOnigurumaLib = oniguruma.loadWASM(wasmBin).then(() => {
      return {
        createOnigScanner(patterns: string[]) {
          return new oniguruma.OnigScanner(patterns);
        },
        createOnigString(s: string) {
          return new oniguruma.OnigString(s);
        },
      };
    });

    this.registry = new vsctm.Registry({
      onigLib: vscodeOnigurumaLib,
      async loadGrammar(scopeName) {
        const scopeMap: any = {
          "source.yaml": "yaml",
          "text.html.markdown": "markdown",
          "text.html.basic": "html",
          "text.html.derivative": "html-derivative",
        };

        if (scopeMap[scopeName] != null) {
          return self.parseGrammarFromFile(`../../syntaxes/${scopeMap[scopeName]}.tmLanguage.json`);
        }
        return null;
      },
    });
  }

  async parseGrammarFromFile(filePath: string) {
    const data = await readFile(path.join(__dirname, filePath));
    return vsctm.parseRawGrammar(data.toString(), filePath);
  }

  async loadGrammar(scopeName: string): Promise<vsctm.IGrammar> {
    if (this.grammars.has(scopeName)) {
      return this.grammars.get(scopeName)!;
    }
    const grammar = await this.registry.loadGrammar(scopeName);

    if (grammar == null) {
      throw new Error(`Cannot load grammar for the scope '${scopeName}'`);
    }

    this.grammars.set(scopeName, grammar);
    return grammar;
  }

  async tokenize(scopeName: string, text: string | string[]): Promise<Token[]> {
    const grammar = await this.loadGrammar(scopeName);

    let ruleStack = vsctm.INITIAL;
    const lines = text instanceof Array ? text : text.split("\n");

    return lines.flatMap((line, i) => {
      const { tokens, ruleStack: ruleStack1 } = grammar.tokenizeLine(line, ruleStack);
      ruleStack = ruleStack1;

      return tokens.map((token) => ({
        token: token,
        start: { line: i, character: token.startIndex },
        end: { line: i, character: token.endIndex },
        scopes: token.scopes,
        content: line.substring(token.startIndex, token.endIndex),
      }));
    });
  }
}
