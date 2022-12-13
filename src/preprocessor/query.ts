import path from "path";
import * as vm from "vm";

import { Logger } from "../logger";
import { filterElements, findElement, foldElements, MarkdownDocument } from "../markdown";
import { mapElements } from "../markdown/types";
import { DocumentProvider } from "../providers/document-provider";

export class QueryManager {
  constructor(protected documentProvider: DocumentProvider, protected logger: Logger) {}

  async runQuery(query: string, filePath: string) {
    try {
      return vm.runInNewContext(query, {
        require,

        documents: Array.from(this.documentProvider.documents.values()),
        filePath,
        dirPath: path.dirname(filePath),
        rootPath: process.cwd(),

        hasKeyword(document: MarkdownDocument, keyword: string) {
          return document.metadata.keywords?.includes(keyword);
        },

        hasEveryKeyword(document: MarkdownDocument, keywords: string[]) {
          return keywords.every(k => document.metadata.keywords?.includes(k));
        },

        hasSomeKeyword(document: MarkdownDocument, keywords: string[]) {
          return keywords.some(k => document.metadata.keywords?.includes(k));
        },

        foldElements,
        mapElements,
        filterElements,
        findElement,
      });
    } catch (e: any) {
      return e.toString();
    }
  }
}