import { MarkdownDocument } from "./types";

export {
  MarkdownElement,
  MarkdownDocument,
  foldElements,
  filterElements,
  findElement,
  getElementAt,
  getElementChildren,
  getElementsAt,
} from "./types";
export {
  Token,
  TokenScope,
  Tokenizer as MarkdownTokenizer,
  getTokensContent,
  getTokensRange,
} from "../parsec/tokenizer";
export { Position, Range, isWithinRange } from "../parsec/position";
export { MarkdownParser, parseDocument, parseElement } from "./parser";
export { documentPreview } from "./preview";

export function renderDocument(document: MarkdownDocument) {
  let content = "";
  let lastLine = 0;
  for (const element of document.elements) {
    if (element.start.line > lastLine) {
      content += "\n".repeat(element.start.line - lastLine);
    }
    lastLine = element.end.line;
    content += element.content;
  }

  return content;
}
