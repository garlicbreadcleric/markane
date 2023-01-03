import path from "path";
import * as url from "url";

import {
  CodeAction,
  CodeActionParams,
  Position,
  Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Config } from "../config";
import * as markdown from "../markdown";
import { MarkdownCitation } from "../markdown/types";
import { CitationProvider } from "../providers/citation-provider";
import { DocumentProvider } from "../providers/document-provider";
import { TemplateProvider } from "../providers/template-provider";

export class ActionManager {
  constructor(
    protected config: Config,
    protected documentProvider: DocumentProvider,
    protected citationProvider: CitationProvider,
    protected templateProvider: TemplateProvider
  ) {}

  async onCodeAction(
    textDocument: TextDocument,
    params: CodeActionParams
  ): Promise<CodeAction[]> {
    const actions: CodeAction[] = [];

    const document = await this.documentProvider.getDocumentBySrc(
      url.fileURLToPath(params.textDocument.uri),
      textDocument.getText()
    );

    const sourceAction = await this.createSourceNoteCodeAction(
      document,
      params
    );
    if (sourceAction != null) {
      actions.push(sourceAction);
    }

    const noteAction = await this.createNoteCodeAction(textDocument, params);
    if (noteAction != null) {
      actions.push(noteAction);
    }

    return actions;
  }

  async createSourceNoteCodeAction(
    document: markdown.MarkdownDocument,
    params: CodeActionParams
  ): Promise<CodeAction | null> {
    const element = markdown.getElementAt(
      document.elements,
      params.range.start
    );

    if (
      element == null ||
      element.type !== "citation" ||
      !markdown.isWithinRange(params.range.start, element) ||
      !markdown.isWithinRange(params.range.end, element)
    ) {
      return null;
    }

    const sourceDirectory = this.config.citations?.folders?.at(0);
    if (sourceDirectory == null) return null;

    const citationTarget = await this.documentProvider.getDocumentByCitationKey(
      element.key.content
    );

    if (citationTarget != null) return null;

    const citationEntry = this.citationProvider.getByCitationKey(
      element.key.content
    );

    const { filePath, fileContent } =
      await this.templateProvider.prepareToCreateFile(
        `${process.cwd()}/${sourceDirectory}`,
        {
          citationEntry,
        }
      );

    const action: CodeAction = {
      title: "Create a source note",
      edit: {
        documentChanges: [
          { kind: "create", uri: filePath },
          {
            textDocument: { uri: filePath, version: null },
            edits: [
              {
                range: Range.create(
                  Position.create(0, 0),
                  Position.create(0, 0)
                ),
                newText: fileContent,
              },
            ],
          },
        ],
      },
    };
    return action;
  }

  async createNoteCodeAction(
    textDocument: TextDocument,
    params: CodeActionParams
  ): Promise<CodeAction | null> {
    const noteDirectory = this.config.folders?.at(0)?.path;
    if (noteDirectory == null) return null;

    const offsetStart = textDocument.offsetAt(params.range.start);
    const offsetEnd = textDocument.offsetAt(params.range.end);
    const selectedText = textDocument.getText().slice(offsetStart, offsetEnd);

    if (selectedText.length === 0) return null;

    const { filePath, fileContent } =
      await this.templateProvider.prepareToCreateFile(
        `${process.cwd()}/${noteDirectory}`,
        {
          title: selectedText,
        }
      );

    const relativeFilePath = path.relative(
      path.dirname(url.fileURLToPath(textDocument.uri)),
      filePath
    );

    const action: CodeAction = {
      title: "Create a note",
      edit: {
        documentChanges: [
          { kind: "create", uri: filePath },
          {
            textDocument: { uri: filePath, version: null },
            edits: [
              {
                range: Range.create(
                  Position.create(0, 0),
                  Position.create(0, 0)
                ),
                newText: fileContent,
              },
            ],
          },
          {
            textDocument: { uri: textDocument.uri, version: null },
            edits: [
              {
                range: params.range,
                newText: `[${selectedText}](${relativeFilePath})`,
              },
            ],
          },
        ],
      },
    };
    return action;
  }
}
