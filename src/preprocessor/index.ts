import { MarkdownDocument, MarkdownElement } from "../markdown";
import { QueryManager } from "./query";

export class Preprocessor {
  constructor(protected queryManager: QueryManager) {}

  async preprocess(document: MarkdownDocument): Promise<MarkdownDocument> {
    const newDocument = Object.assign({}, document);

    const newElements: MarkdownElement[] = [];

    let i = 0;
    while (i < document.elements.length) {
      const currentElement = document.elements[i];
      if (
        currentElement.type === "fencedCode" &&
        currentElement.language === "markane-query"
      ) {
        const queryResult = await this.queryManager.runQuery(
          currentElement.code,
          document.filePath
        );

        let end = currentElement.end;

        let j = i + 1;
        while (j < document.elements.length) {
          if (document.elements[j].type != "raw") break;
          j++;
        }

        const possibleOutput = document.elements[j];
        if (
          possibleOutput != null &&
          possibleOutput.type === "fencedDiv" &&
          possibleOutput.attributes === "markane-output"
        ) {
          i = j + 1;
          end = possibleOutput.end;
        } else {
          i++;
        }

        newElements.push(currentElement);
        newElements.push({
          type: "raw",
          content: this.renderQueryOutput(queryResult),
          start: currentElement.end,
          end,
        });
      } else {
        newElements.push(currentElement);
        i++;
      }
    }

    newDocument.elements = newElements;

    return newDocument;
  }

  renderQueryOutput(result: any): string {
    return `\n\n::: markane-output\n${result.toString()}\n:::`;
  }
}
