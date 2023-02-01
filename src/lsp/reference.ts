import * as path from "path";
import * as url from "url";

import { Location } from "vscode-languageserver";

import * as markdown from "../markdown";
import { Config } from "../config";
import { DocumentProvider } from "../providers/document-provider";
import { findIndicesOf, nullableToArray } from "../utils";

export class ReferenceManager {
  constructor(protected config: Config, protected documentProvider: DocumentProvider) {}

  getReferencesToPath(filePath: string): Location[] {
    const locations: Location[] = [];

    for (const doc of this.documentProvider.documents.values()) {
      const references = markdown.filterElements((e) => {
        if (e.type === "inlineLink" && e.path != null) {
          return path.join(path.dirname(doc.filePath), e.path.content) === filePath;
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

  getMentions(document: markdown.MarkdownDocument): Location[] {
    const titles: string[] = [...nullableToArray(document.title), ...(document.metadata?.aliases ?? [])];

    const locations: Location[] = [];

    for (const doc of this.documentProvider.documents.values()) {
      if (doc.filePath === document.filePath) {
        continue;
      }
      for (const title of titles) {
        if (doc.source == null) continue;
        const startIndices = findIndicesOf(title, doc.source);

        for (const startIndex of startIndices) {
          const start = positionAt(doc.source, startIndex);
          const end = positionAt(doc.source, startIndex + title.length);

          const element =
            markdown.getElementAt(doc.elements, start, true) ?? markdown.getElementAt(doc.elements, end, true);
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

function positionAt(src: string, offset: number): markdown.Position {
  const position: markdown.Position = { line: 0, character: 0 };
  for (let i = 0; i < offset && i < src.length; i++) {
    const c = src[i];
    if (c === "\n") {
      position.line += 1;
      position.character = 0;
    } else if (c === "\r") {
      // I think '\r' should be ignored, but I'm not sure.
      // TODO: Check VS Code's implementation.
    } else {
      position.character += 1;
    }
  }

  return position;
}
