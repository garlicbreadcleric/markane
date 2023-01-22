import url from "url";
import path from "path";
import assert from "assert";

import {
  TextDocuments,
  createConnection,
  TextDocumentSyncKind,
  FileChangeType,
  CodeAction,
  CodeActionParams,
  Location,
  CodeLens,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import * as markdown from "../markdown";
import * as utils from "../utils";
import { Config } from "../config";
import { DocumentProvider } from "../providers/document-provider";
import { CitationProvider } from "../providers/citation-provider";
import { CompletionManager } from "./completion";
import { Logger } from "../logger";
import { DefinitionManager } from "./definition";
import { SymbolManager } from "./symbol";
import { TemplateProvider } from "../providers/template-provider";
import { SnippetProvider } from "../providers/snippet-provider";
import { ActionManager } from "./action";
import { ReferenceManager } from "./reference";

export async function runLspServer(
  config: Config,
  logger: Logger,
  documentProvider: DocumentProvider,
  citationProvider: CitationProvider,
  templateProvider: TemplateProvider,
  snippetProvider: SnippetProvider
) {
  const completionManager = new CompletionManager(
    config,
    documentProvider,
    citationProvider,
    snippetProvider
  );
  const definitionManager = new DefinitionManager(config, documentProvider);
  const symbolManager = new SymbolManager(config, documentProvider);
  const actionManager = new ActionManager(
    config,
    documentProvider,
    citationProvider,
    templateProvider
  );
  const referenceManager = new ReferenceManager(config, documentProvider);

  const connection = createConnection(process.stdin, process.stdout);
  const documents = new TextDocuments(TextDocument);

  connection.onInitialize((params) => {
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ["[", "@", "/"],
        },
        codeActionProvider: true,
        hoverProvider: true,
        definitionProvider: true,
        workspaceSymbolProvider: true,
        documentSymbolProvider: true,
        referencesProvider: true,
        codeLensProvider: {
          resolveProvider: false,
        },
        executeCommandProvider: {
          commands: ["markane/showReferences", "markane/showMentions"],
        },
      },
    };
  });

  connection.onInitialized(async () => {
    await Promise.all([
      documentProvider.index(),
      citationProvider.index(),
      snippetProvider.index(),
    ]);
  });

  connection.onDidChangeWatchedFiles(async (params) => {
    for (const change of params.changes) {
      if (
        change.type === FileChangeType.Created ||
        change.type === FileChangeType.Changed
      ) {
        await documentProvider.updateDocument(url.fileURLToPath(change.uri));
      }

      if (change.type === FileChangeType.Deleted) {
        console.error(change.uri);
        await documentProvider.deleteDocument(url.fileURLToPath(change.uri));
      }
    }
  });

  connection.onCompletion(async (params) => {
    const textDocument = documents.get(params.textDocument.uri);
    if (textDocument == null) return;

    return await completionManager.onCompletion(params, textDocument);
  });

  connection.onCompletionResolve(async (item) => {
    return await completionManager.onCompletionResolve(item);
  });

  connection.onDefinition(async (params) => {
    const textDocument = documents.get(params.textDocument.uri);
    if (textDocument == null) return;

    return await definitionManager.onDefinition(params, textDocument);
  });

  connection.onWorkspaceSymbol(async (params) => {
    return await symbolManager.onWorkspaceSymbol(params);
  });

  connection.onDocumentSymbol(async (params) => {
    const textDocument = documents.get(params.textDocument.uri);
    if (textDocument == null) return null;
    return await symbolManager.onDocumentSymbol(params, textDocument);
  });

  connection.onReferences(async (params) => {
    const textDocument = documents.get(params.textDocument.uri);
    if (textDocument == null) return null;
    const documentPath = url.fileURLToPath(textDocument.uri);
    return referenceManager.getReferencesToPath(documentPath);
  });

  connection.onCodeLens(async (params) => {
    const textDocument = documents.get(params.textDocument.uri);
    if (textDocument == null) return null;
    const documentPath = url.fileURLToPath(textDocument.uri);
    const document = await documentProvider.getDocumentBySrc(
      documentPath,
      textDocument.getText()
    );

    const heading = markdown.findElement(
      (e) => e.type === "heading" && e.level === 1,
      document.elements
    );

    const referencesLocations =
      referenceManager.getReferencesToPath(documentPath);
    const mentionsLocations = referenceManager.getMentions(documents, document);

    const range =
      heading == null
        ? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
        : { start: heading.start, end: heading.end };
    const position = range.start;

    const referencesLens: CodeLens = {
      command: {
        command: "markane/showReferences",
        title:
          `${referencesLocations.length} ` +
          (referencesLocations.length === 1 ? "reference" : "references"),
        arguments: [params.textDocument.uri, position, referencesLocations],
      },
      range,
    };

    // TODO: Allow to disable via `markane.yaml`.
    const mentionsLens: CodeLens = {
      command: {
        command: "markane/showMentions",
        title:
          `${mentionsLocations.length} ` +
          (mentionsLocations.length === 1 ? "mention" : "mentions"),
        arguments: [params.textDocument.uri, position, mentionsLocations],
      },
      range,
    };

    return [referencesLens, mentionsLens];
  });

  connection.onCodeAction(async (params: CodeActionParams) => {
    const textDocument = documents.get(params.textDocument.uri);
    if (textDocument == null) return null;
    return await actionManager.onCodeAction(textDocument, params);
  });

  connection.onCodeActionResolve(async (action: CodeAction) => {
    return action;
  });

  connection.onHover(async (params) => {
    try {
      const textDocument = documents.get(params.textDocument.uri);
      if (textDocument == null) return null;
      const src = textDocument.getText();
      const doc = await documentProvider.getDocumentBySrc(
        url.fileURLToPath(params.textDocument.uri),
        src
      );

      const position = {
        line: params.position.line,
        character: params.position.character,
      };

      const element = markdown.getElementAt(doc.elements, position, true);
      if (element == null) return null;

      const { start, end } = element;

      const isOverInlineLinkPath =
        element.type === "inlineLink" &&
        element.path != null &&
        markdown.isWithinRange(position, element.path);
      const isOverInlineImagePath =
        element.type === "inlineImage" &&
        element.path != null &&
        markdown.isWithinRange(position, element.path);
      const hasRelativePath =
        (isOverInlineLinkPath || isOverInlineImagePath) &&
        utils.isRelativeLink(element.path!.content);

      if (element.type === "comment") return null;
      if (hasRelativePath && path.extname(element.path!.content) === ".md") {
        assert(element.path != null);

        const target = await documentProvider.getDocumentByPath(
          path.join(
            path.dirname(url.fileURLToPath(params.textDocument.uri)),
            element.path.content
          )
        );
        if (target == null) return null;

        const preview = await documentProvider.updateDocumentPreview(target);
        if (preview == null) return null;

        return {
          range: { start: element.path.start, end: element.path.end },
          contents: {
            kind: "markdown",
            value: preview,
          },
        };
      }

      if (element.type === "citation") {
        const target = await documentProvider.getDocumentByCitationKey(
          element.key.content
        );
        if (target == null) return null;
        const preview = await documentProvider.updateDocumentPreview(target);

        if (preview == null) return null;
        return {
          range: { start, end },
          contents: {
            kind: "markdown",
            value: preview,
          },
        };
      }

      if (
        hasRelativePath &&
        [".png", ".jpg", ".jpeg", ".gif"].includes(
          path.extname(element.path!.content).toLowerCase()
        )
      ) {
        assert(element.path != null);

        const target = path.join(
          path.dirname(url.fileURLToPath(params.textDocument.uri)),
          element.path.content
        );

        const targetExists = await utils.isFileReadable(target);

        if (!targetExists) return null;
        return {
          range: { start: element.path.start, end: element.path.end },
          contents: {
            kind: "markdown",
            value: `<img src="${target}" width=400px>`,
          },
        };
      }
    } catch (e: any) {
      return {
        contents: {
          kind: "plaintext",
          value: e.toString(),
        },
      };
    }

    return null;
  });

  connection.onNotification("markane/indexDocuments", async () => {
    await documentProvider.index();
  });

  connection.onExecuteCommand(async (params) => {
    switch (params.command) {
      case "markane/showReferences":
      case "markane/showMentions": {
        const uri = params.arguments?.at(0);
        const position = params.arguments?.at(1);
        const locations = params.arguments?.at(2);

        if (uri != null && locations != null) {
          await connection.sendNotification("markane/showReferences", [
            uri,
            position,
            locations,
          ]);
        }
      }
    }
  });

  documents.listen(connection);
  connection.listen();
}
