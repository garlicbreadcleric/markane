import url from "url";

import * as markdown from "../markdown";
import {
  DocumentSymbol,
  DocumentSymbolParams,
  Position,
  Range,
  SymbolKind,
  WorkspaceSymbol,
  WorkspaceSymbolParams,
} from "vscode-languageserver";
import { Config } from "../config";
import { DocumentProvider } from "../providers/document-provider";
import { TextDocument } from "vscode-languageserver-textdocument";
import { MarkdownHeading } from "../markdown/types";
import path from "path";

export type MarkdownHeadingTree = {
  heading: MarkdownHeading;
  children: MarkdownHeadingTree;
}[];

export class SymbolManager {
  constructor(protected config: Config, protected documentProvider: DocumentProvider) {}

  async onWorkspaceSymbol(params: WorkspaceSymbolParams): Promise<WorkspaceSymbol[]> {
    return Array.from(this.documentProvider.documents.values()).map((document) => {
      const heading = markdown.findElement((e) => e.type === "heading" && e.level === 1, document.elements);

      const range = heading == null ? Range.create(Position.create(0, 0), Position.create(0, 0)) : heading;

      const filePath = path.relative(process.cwd(), document.filePath);

      return {
        name: document.title != null ? `${document.title}  ${filePath}` : filePath,
        kind: SymbolKind.File,
        location: {
          uri: url.pathToFileURL(document.filePath).toString(),
          range,
        },
      };
    });
  }

  async onDocumentSymbol(params: DocumentSymbolParams, textDocument: TextDocument): Promise<DocumentSymbol[]> {
    const src = textDocument.getText();
    const document = await this.documentProvider.getDocumentBySrc(url.fileURLToPath(textDocument.uri), src);

    const headings = <MarkdownHeading[]>markdown.filterElements((e) => e.type === "heading", document.elements);
    const headingTree = this.headingListToTree(headings);

    return this.headingTreeToSymbolList(headingTree);
  }

  headingListToTree(headings: MarkdownHeading[]): MarkdownHeadingTree {
    const roots: MarkdownHeadingTree = [];

    for (const heading of headings) {
      let target = roots;
      while (target != null && target.length > 0 && target[target.length - 1].heading.level < heading.level) {
        target = target[target.length - 1].children;
      }
      target.push({ heading, children: [] });
    }

    return roots;
  }

  headingTreeToSymbolList(headingTree: MarkdownHeadingTree): DocumentSymbol[] {
    return headingTree.map(({ heading, children }) => {
      return {
        kind: SymbolKind.String,
        name: /*'#'.repeat(heading.level) + ' ' +*/ heading.title.content,
        range: heading,
        selectionRange: heading,
        children: this.headingTreeToSymbolList(children),
      };
    });
  }
}
