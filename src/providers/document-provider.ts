import path from "path";
import fs from "fs";

import * as pandoc from "../pandoc";
import * as utils from "../utils";
import { MarkdownDocument, MarkdownParser } from "../markdown";
import { Config } from "../config";
import { Logger } from "../logger";

export class DocumentProvider {
  public documents: Map<string, MarkdownDocument> = new Map();
  constructor(
    protected config: Config,
    protected parser: MarkdownParser,
    protected logger: Logger
  ) {}

  async index() {
    this.documents = new Map();

    const cwd = process.cwd();

    for (const folder of this.config.folders ?? []) {
      if ((folder.type ?? "note") != "note") {
        continue; // TODO.
      }

      if (folder.path == null) {
        continue;
      }

      const folderPath = path.resolve(cwd, folder.path);
      const files = (
        await utils.readDirFiles(folderPath, folder.recursive ?? false)
      ).filter((f) => path.extname(f) === ".md");

      for (const file of files) {
        await this.updateDocument(file);
      }
    }
  }

  async updateDocument(
    filePath: string,
    doc: MarkdownDocument | null = null
  ): Promise<MarkdownDocument | null> {
    if (!this.isPathIncluded(filePath)) return null;

    if (doc == null) {
      doc = await this.getDocumentByPath(filePath, true);
    }
    if (doc != null) {
      this.documents.set(filePath, doc);
      return doc;
    }
    return null;
  }

  async deleteDocument(filePath: string) {
    this.documents.delete(filePath);
  }

  async updateDocumentPreview(doc: MarkdownDocument): Promise<string | null> {
    if (doc.source == null) return null;
    if (this.config.pandocPreview) {
      const pandocOutput = await pandoc.convert(doc.source, {
        cwd: path.dirname(doc.filePath),
      });
      doc.preview = await this.parser.preview(doc.filePath, pandocOutput);
    } else {
      doc.preview = await this.parser.preview(doc.filePath, doc.source);
    }
    return doc.preview;
  }

  async getDocumentBySrc(
    filePath: string,
    src: string
  ): Promise<MarkdownDocument> {
    const doc = await this.parser.parse(filePath, src);
    return doc;
  }

  async getDocumentByPath(
    filePath: string,
    forceNew = false
  ): Promise<MarkdownDocument | null> {
    if (this.documents.has(filePath) && !forceNew) {
      return this.documents.get(filePath) ?? null;
    }

    const fileReadable = await utils.isFileReadable(filePath);
    if (!fileReadable) return null;

    const src = await utils.readFile(filePath).then((data) => data.toString());

    const doc = await this.getDocumentBySrc(filePath, src);
    return doc;
  }

  async getDocumentByCitationKey(
    citationKey: string,
    forceNew = false
  ): Promise<MarkdownDocument | null> {
    const cwd = process.cwd();
    for (const folder of this.config?.citations?.folders ?? []) {
      const folderPath = path.join(cwd, folder);
      const filePath = path.join(folderPath, `${citationKey}.md`);
      const doc = await this.getDocumentByPath(filePath, forceNew);
      if (doc != null) return doc;
    }

    return null;
  }

  isPathIncluded(filePath: string): boolean {
    const cwd = process.cwd();
    if (!(path.extname(filePath) === ".md")) return false; // TODO: Maybe also move to config?
    for (const folder of this.config.folders ?? []) {
      if (folder.path == null) continue;
      const folderPath = path.resolve(cwd, folder.path);
      if (!path.relative(folderPath, filePath).startsWith("../")) {
        return true;
      }
    }

    return false;
  }
}
