import url from "url";
import path from "path";

import {
  DefinitionParams,
  LocationLink,
  Position,
  Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import * as markdown from "../markdown";
import * as utils from "../utils";
import { Config } from "../config";
import { DocumentProvider } from "../providers/document-provider";
import { MarkdownInlineLink } from "../markdown/types";
import { MarkdownInlineImage } from "../markdown/types";
import { MarkdownCitation } from "../markdown/types";
import assert from "assert";

export class DefinitionManager {
  constructor(
    protected config: Config,
    protected documentProvider: DocumentProvider
  ) {}

  async onDefinition(
    params: DefinitionParams,
    textDocument: TextDocument
  ): Promise<LocationLink[] | null> {
    const src = textDocument.getText();
    const doc = await this.documentProvider.getDocumentBySrc(
      url.fileURLToPath(params.textDocument.uri),
      src
    );

    const element = markdown.getElementAt(doc.elements, params.position, true);

    if (element == null) return null;

    const hasLocalLink =
      (element.type === "inlineImage" || element.type === "inlineLink") &&
      element.path !== null &&
      !utils.isUri(element.path.content) &&
      markdown.isWithinRange(params.position, element.path);

    switch (element.type) {
      case "inlineLink":
      case "inlineImage": {
        if (hasLocalLink) {
          if (path.extname(element.path!.content) === ".md") {
            return await this.getMarkdownLinkDefinition(params, element);
          } else {
            return await this.getAssetDefinition(params, element);
          }
        }
        return null;
      }
      case "citation":
        return await this.getCitationDefinition(params, element);
    }

    return null;
  }

  async getMarkdownLinkDefinition(
    params: DefinitionParams,
    element: MarkdownInlineLink | MarkdownInlineImage
  ): Promise<LocationLink[] | null> {
    // TODO: Change type instead of assert?
    assert(element.path != null);

    const target = await this.documentProvider.getDocumentByPath(
      path.join(
        path.dirname(url.fileURLToPath(params.textDocument.uri)),
        element.path.content
      )
    );
    if (target == null) return null;

    const targetHeading = markdown.findElement(
      (e) => e.type === "heading" && e.level === 1,
      target.elements
    );

    const targetRange =
      targetHeading == null
        ? Range.create(Position.create(0, 0), Position.create(0, 0))
        : targetHeading;

    return [
      LocationLink.create(
        url.pathToFileURL(target.filePath).toString(),
        targetRange,
        targetRange,
        element.path
      ),
    ];
  }

  async getAssetDefinition(
    params: DefinitionParams,
    element: MarkdownInlineLink | MarkdownInlineImage
  ): Promise<LocationLink[] | null> {
    // TODO: Change type instead of assert?
    assert(element.path != null);

    const targetPath = path.join(
      path.dirname(url.fileURLToPath(params.textDocument.uri)),
      element.path.content
    );

    if (!(await utils.isFileReadable(targetPath))) return null;

    const dummyRange = Range.create(
      Position.create(0, 0),
      Position.create(1, 1)
    );

    return [
      LocationLink.create(
        url.pathToFileURL(targetPath).toString(),
        dummyRange,
        dummyRange,
        element.path
      ),
    ];
  }

  async getCitationDefinition(
    params: DefinitionParams,
    element: MarkdownCitation
  ): Promise<LocationLink[] | null> {
    if (
      element.key == null ||
      !markdown.isWithinRange(params.position, element.key)
    )
      return null;

    const target = await this.documentProvider.getDocumentByCitationKey(
      element.key.content
    );
    if (target == null) return null;

    const targetHeading = markdown.findElement(
      (e) => e.type === "heading" && e.level === 1,
      target.elements
    );
    const targetRange =
      targetHeading == null
        ? Range.create(Position.create(0, 0), Position.create(0, 0))
        : targetHeading;

    return [
      LocationLink.create(
        url.pathToFileURL(target.filePath).toString(),
        targetRange,
        targetRange,
        element.key
      ),
    ];
  }
}
