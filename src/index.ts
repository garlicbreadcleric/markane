#!/usr/bin/env node

import * as lsp from "./lsp";
import * as cli from "./cli";
import readline from "readline";

import * as markdown from "./markdown";
import { Logger } from "./logger";
import { getConfig } from "./config";
import { DocumentProvider } from "./providers/document-provider";
import { CitationProvider } from "./providers/citation-provider";
import { TemplateProvider } from "./providers/template-provider";
import { SnippetProvider } from "./providers/snippet-provider";

const cliParserOptions = {
  executableName: "markane",
  description: "Markane - Arcane focus for Markdown spell-casting",
  commands: {
    new: {
      description: "Create a new note",
      options: {
        title: {
          short: "t",
          description: "Note title",
          type: cli.CliCommandOptionType.String,
        },
        citationKey: {
          short: "c",
          description: "Source note citation key",
          type: cli.CliCommandOptionType.String,
        },
        template: {
          short: "T",
          description: "Handlebars template name",
          type: cli.CliCommandOptionType.String,
        },
        keyword: {
          short: "k",
          description: "Note keywords",
          type: cli.CliCommandOptionType.List,
        },
      },
    },
    bibliography: {
      description: "List available bibliography entries",
      options: {
        citationKey: {
          short: "c",
          description:
            "Citation key (will output all citation entries if none provided)",
          type: cli.CliCommandOptionType.String,
        },
      },
    },
    lsp: {
      description: "Run language server",
      options: {},
    },
    parse: {
      description:
        "Parse Markdown and show abstract syntax representation (for development purposes only)",
      options: {
        input: {
          short: "i",
          description:
            "Input file path (will read from stdin if none provided)",
          type: cli.CliCommandOptionType.String,
        },
        output: {
          short: "o",
          description:
            "Output file path (will write to stdout if none provided)",
          type: cli.CliCommandOptionType.String,
        },
        format: {
          short: "f",
          description: "Output format",
          oneOf: ["textmate", "markane"],
          default: "markane",
        },
      },
    },
    help: {
      description: "Show help message",
    },
  },
};

async function readStdin() {
  const rl = readline.createInterface({
    input: process.stdin,
  });

  let result = ``;
  for await (const line of rl) {
    result += `${line}\n`;
  }
  return result;
}

export async function main() {
  const config = (await getConfig()) ?? {};
  const logger = new Logger(config);

  const tokenizer = new markdown.MarkdownTokenizer();
  const markdownParser = new markdown.MarkdownParser(tokenizer);

  const documentProvider = new DocumentProvider(config, markdownParser, logger);
  const citationProvider = new CitationProvider(config, logger);
  const templateProvider = new TemplateProvider(config, logger);
  const snippetProvider = new SnippetProvider(config);

  const cliParser = new cli.CliParser(cliParserOptions, logger);
  const cliOptions = cliParser.parse(process.argv.slice(2));

  switch (cliOptions.command) {
    case "new":
      if (cliOptions.arguments.length < 1) {
        logger.error("Expected an argument.");
        process.exit(1);
      }

      await citationProvider.index();
      const citationEntry =
        cliOptions.options.citationKey == null
          ? null
          : citationProvider.getByCitationKey(cliOptions.options.citationKey);

      await templateProvider.createFile(cliOptions.arguments[0], {
        title: cliOptions.options.title,
        citationEntry,
        template: cliOptions.options.template,
        keywords: cliOptions.options.keyword,
      });
      break;
    case "bibliography": {
      await citationProvider.index();
      if (cliOptions.options.citationKey != null) {
        const entry = citationProvider.getByCitationKey(
          cliOptions.options.citationKey
        );
        console.log(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(citationProvider.bibliography));
      }
      break;
    }
    case "lsp":
      lsp.runLspServer(
        config,
        logger,
        documentProvider,
        citationProvider,
        templateProvider,
        snippetProvider
      );
      break;
    case "parse":
      let input = null;
      if (cliOptions.options.input == null) {
        input = await readStdin();
      } else {
        console.error(`Unimplemented.`); // todo.
        process.exit(1);
      }
      switch (cliOptions.options.format) {
        case "markane": {
          const doc = await markdownParser.parse("input.md", input);
          console.log(JSON.stringify(doc, null, 2));
          break;
        }
        case "textmate": {
          const lines = await tokenizer.tokenize("text.html.markdown", input);
          for (const line of lines) {
            for (const { start, end, scopes, content } of line) {
              console.log(
                JSON.stringify(
                  { start, end, scopes: scopes.join(", "), content },
                  null,
                  2
                )
              );
            }
          }
          break;
        }
      }
      break;
    case "help":
      console.log(cliParser.help());
      break;
  }
}
