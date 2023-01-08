import * as path from "path";
import * as url from "url";

import { Location } from "vscode-languageserver";

import * as markdown from "../markdown";
import { Config } from "../config";
import { DocumentProvider } from "../providers/document-provider";

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
}
