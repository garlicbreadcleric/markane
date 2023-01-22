import * as path from "path";
import * as url from "url";

import { Location, TextDocuments } from "vscode-languageserver";

import * as markdown from "../markdown";
import { Config } from "../config";
import { DocumentProvider } from "../providers/document-provider";
import { findIndicesOf } from "../utils";
import { TextDocument } from "vscode-languageserver-textdocument";

export class ReferenceManager {
  constructor(
    protected config: Config,
    protected documentProvider: DocumentProvider
  ) {}

  getReferencesToPath(filePath: string): Location[] {
    const locations: Location[] = [];

    for (const doc of this.documentProvider.documents.values()) {
      const references = markdown.filterElements((e) => {
        if (e.type === "inlineLink" && e.path != null) {
          return (
            path.join(path.dirname(doc.filePath), e.path.content) === filePath
          );
        } else if (e.type === "citation") {
          if (e.key.content !== path.basename(filePath, ".md")) {
            return false;
          }
          for (const folder of this.config.citations?.folders ?? []) {
            const folderPath = path.join(process.cwd(), folder);
            if (!path.relative(folderPath, filePath).startsWith("../")) {
              return true;
            }
          }
          return false;
        } else {
          return false;
        }
      }, doc.elements);
      for (const reference of references) {
        locations.push({
          range: { start: reference.start, end: reference.end },
          uri: url.pathToFileURL(doc.filePath).toString(),
        });
      }
    }

    return locations;
  }

  getMentions(
    textDocuments: TextDocuments<TextDocument>,
    document: markdown.MarkdownDocument
  ): Location[] {
    const titles = [
      document.title ?? null,
      ...(document.metadata?.aliases ?? []),
    ].filter((x) => x != null);

    const locations: Location[] = [];

    for (const doc of this.documentProvider.documents.values()) {
      if (doc.filePath === document.filePath) {
        continue;
      }
      for (const title of titles) {
        if (doc.source == null) continue;
        const textDocument = textDocuments.get(
          url.pathToFileURL(doc.filePath).toString()
        );
        if (textDocument == null) continue;
        const startIndices = findIndicesOf(title, doc.source);

        for (const startIndex of startIndices) {
          const start = textDocument.positionAt(startIndex);
          const end = textDocument.positionAt(startIndex + title.length);

          const element =
            markdown.getElementAt(doc.elements, start, true) ??
            markdown.getElementAt(doc.elements, end, true);
          if (element?.type === "inlineLink") continue;

          const location: Location = {
            range: { start, end },
            uri: url.pathToFileURL(doc.filePath).toString(),
          };
          locations.push(location);
        }
      }
    }

    return locations;
  }
}
