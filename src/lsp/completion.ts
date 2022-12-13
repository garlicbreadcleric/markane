import url from "url";
import path from "path";

import * as markdown from "../markdown";
import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CompletionParams,
  CompletionTriggerKind,
  InsertReplaceEdit,
  Position,
  Range,
  TextEdit,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Config } from "../config";
import { CitationProvider } from "../providers/citation-provider";
import { DocumentProvider } from "../providers/document-provider";
import { MarkdownElementBase } from "../markdown/types";
import { SnippetProvider } from "../providers/snippet-provider";

// export const MAX_NUMBER_OF_COMPLETION_ITEMS: number = 300;

export class CompletionManager {
  constructor(
    protected config: Config,
    protected documentProvider: DocumentProvider,
    protected citationProvider: CitationProvider,
    protected snippetProvider: SnippetProvider
  ) {}

  async getSurroundingLinkRange(
    position: Position,
    textDocument: TextDocument,
    element: markdown.MarkdownElement | null
  ): Promise<MarkdownElementBase | null> {
    const src = textDocument.getText();
    const isInsideBrackets =
      element == null &&
      src[textDocument.offsetAt(position) - 1] === "[" &&
      src[textDocument.offsetAt(position)] === "]";
    if (isInsideBrackets) {
      return {
        content: "",
        start: { line: position.line, character: position.character - 1 },
        end: { line: position.line, character: position.character + 1 },
      };
    }

    const isInsideReference =
      element != null &&
      element.type === "referenceLink" &&
      element.reference != null &&
      element.title == null &&
      markdown.isWithinRange(position, element.reference);

    if (isInsideReference) {
      return {
        content: element.reference!.content,
        start: element.start,
        end: element.end,
      };
    }

    const isInsideLink =
      element != null &&
      element.type === "inlineLink" &&
      element.title != null &&
      markdown.isWithinRange(position, element.title);

    if (isInsideLink) {
      return {
        content: element.title!.content,
        start: element.start,
        end: element.end,
      };
    }

    return null;
  }

  async onCompletion(
    params: CompletionParams,
    textDocument: TextDocument
  ): Promise<CompletionItem[] | CompletionList | null> {
    const src = textDocument.getText();
    const doc = await this.documentProvider.getDocumentBySrc(
      url.fileURLToPath(params.textDocument.uri),
      src
    );

    if (params.context?.triggerCharacter === "/") {
      return await this.onSnippetCompletion(params, textDocument);
    }

    let element = markdown.getElementAt(doc.elements, params.position, true);
    if (element?.type === "raw" || element?.type === "heading") {
      element = null;
    }

    if (element != null && element.type === "comment") return null;

    if (
      params.context?.triggerKind === CompletionTriggerKind.TriggerCharacter &&
      params.context?.triggerCharacter === "@"
    ) {
      return await this.onCitationCompletion(params, textDocument);
    }

    const surroundingLinkRange = await this.getSurroundingLinkRange(
      params.position,
      textDocument,
      element
    );
    if (
      (params.context?.triggerKind === CompletionTriggerKind.TriggerCharacter &&
        params.context?.triggerCharacter === "[" &&
        element == null) ||
      surroundingLinkRange != null
    ) {
      return this.onLinkCompletion(params, doc, surroundingLinkRange);
    }

    return null;
  }

  async onLinkCompletion(
    params: CompletionParams,
    doc: markdown.MarkdownDocument,
    surroundingRange: MarkdownElementBase | null
  ): Promise<CompletionList | null> {
    const query = surroundingRange?.content?.toLowerCase();
    const items = [];
    let isIncomplete = false;

    for (const d of this.documentProvider.documents.values()) {
      // if (items.length >= MAX_NUMBER_OF_COMPLETION_ITEMS) {
      //   isIncomplete = true;
      //   break;
      // }
      // if (query != null && !d.filePath.toLowerCase().includes(query) && !(d.title ?? "").includes(query)) continue;

      const relativePath = path.relative(
        path.dirname(doc.filePath),
        d.filePath
      );

      const link =
        d.title == null ? `](${relativePath})` : `${d.title}](${relativePath})`;

      const item: CompletionItem = {
        label: path.basename(d.filePath),
        detail: d.title,
        filterText:
          d.title == null
            ? path.basename(d.filePath)
            : `${d.title} ${path.basename(d.filePath)}`,
        sortText: d.filePath,
        kind: CompletionItemKind.File,
        additionalTextEdits: [],
        data: {
          type: "link",
          filePath: d.filePath,
        },
      };

      if (d.preview != null) {
        item.documentation = {
          kind: "markdown",
          value: d.preview,
        };
      }

      item.textEdit = InsertReplaceEdit.create(
        link,
        Range.create(params.position, {
          line: params.position.line,
          character: (surroundingRange?.end ?? params.position).character,
        }),
        Range.create(params.position, {
          line: params.position.line,
          character: (surroundingRange?.end ?? params.position).character,
        })
      );

      if (surroundingRange != null) {
        item.additionalTextEdits!.push(
          TextEdit.replace(
            Range.create(surroundingRange.start, params.position),
            "["
          )
        );
      }

      items.push(item);
    }

    return {
      isIncomplete,
      items,
    };
  }

  async onSnippetCompletion(params: CompletionParams, textDocument: TextDocument): Promise<CompletionItem[] | null> {
    // TODO.
    // return [
    //   {
    //     label: "Snippet Template",
    //     kind: CompletionItemKind.Snippet,
    //     insertText: "## foo\n\n- bar\n- baz",
    //     additionalTextEdits: [
    //       TextEdit.replace(
    //         Range.create({ line: params.position.line, character: params.position.character - 1 }, params.position),
    //         ""
    //       )
    //     ]
    //   }
    // ];
    return this.snippetProvider.snippets.map((snippet) => {
      return {
        label: snippet.title,
        kind: CompletionItemKind.Snippet,
        insertText: snippet.text,
        additionalTextEdits: [
          TextEdit.replace(
            Range.create({ line: params.position.line, character: params.position.character - 1 }, params.position),
            ""
          )
        ]
      };
    });
  }

  async onCitationCompletion(
    params: CompletionParams,
    textDocument: TextDocument
  ): Promise<CompletionItem[] | null> {
    return this.citationProvider.bibliography.map((entry) => {
      return {
        label: entry["citation-key"],
        kind: CompletionItemKind.Reference,
        detail: entry.title,
        documentation: entry.abstract,
      };
    });
  }

  async onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
    if (item.data?.type === "link") {
      const document = await this.documentProvider.getDocumentByPath(
        item.data.filePath
      );
      if (document == null) return item;
      await this.documentProvider.updateDocumentPreview(document);
      if (document.preview != null) {
        item.documentation = {
          kind: "markdown",
          value: document.preview,
        };
      }
      return item;
    }

    return item;
  }
}
