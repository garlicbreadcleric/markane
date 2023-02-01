import { expect } from "chai";

import { filterElements, MarkdownElement, MarkdownParser, MarkdownTokenizer, Position, Range } from "../src/markdown";
import {
  MarkdownDocument,
  MarkdownElementBase,
  MarkdownHeading,
  MarkdownInlineLink,
  MarkdownReferenceLink,
} from "../src/markdown/types";
import { comparePositions } from "../src/parsec";

async function createParser() {
  const tokenizer = new MarkdownTokenizer();
  await tokenizer.loadGrammar("text.html.markdown");
  const parser = new MarkdownParser(tokenizer);

  return parser;
}

function getSrcRange(range: Range, src: string): string {
  let result = "";

  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i < range.start.line) continue;
    if (i > range.end.line) break;

    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      if (i <= range.start.line && j < range.start.character) continue;
      if (i >= range.end.line && j >= range.end.character) continue;
      result += line[j];
    }
  }
  return result;
}

function testDocumentSorting(document: MarkdownDocument) {
  for (let i = 0; i < document.elements.length; i++) {
    testElementSorting(document.elements[i]);
    if (i > 0) {
      expect(comparePositions(document.elements[i].end, document.elements[i - 1].start)).to.be.oneOf([0, 1]);
    }
  }
}

function testElementSorting(element: MarkdownElement) {
  if ((<any>element).children != null) {
    const children: MarkdownElement[] = (<any>element).children;

    let lastEnd: Position | null = null;
    for (const child of children) {
      expect(comparePositions(child.start, element.start)).to.be.oneOf([1, 0]);
      expect(comparePositions(child.end, element.end)).to.be.oneOf([-1, 0]);
      if (lastEnd != null) {
        expect(comparePositions(child.start, lastEnd)).to.be.oneOf([1, 0]);
      }
      lastEnd = child.end;
      testElementSorting(child);
    }
  }
}

function testElement(element: MarkdownElementBase, elementContent: string, src: string) {
  expect(element.content).to.be.equal(elementContent);
  expect(element.content).to.be.equal(getSrcRange(element, src));
}

async function parse(src: string, elementType: string | null = null): Promise<MarkdownElement[]> {
  const parser = await createParser();
  const doc = await parser.parse("input.md", src);
  testDocumentSorting(doc);
  const elements = filterElements((e) => (elementType == null ? true : e.type === elementType), doc.elements);
  return elements;
}

describe("Parser tests", () => {
  it("Parsing headings", async () => {
    const src = "# Foo\n\n## Bar ###\n\n### Baz @foo x   #";
    const [h1, h2, h3] = <MarkdownHeading[]>await parse(src, "heading");

    testElement(h1, "# Foo", src);
    testElement(h1.title, "Foo", src);
    expect(h1.level).to.be.equal(1);
    expect(h1.children.length).to.be.equal(0);

    testElement(h2, "## Bar ###", src);
    testElement(h2.title, "Bar", src);
    expect(h2.level).to.be.equal(2);
    expect(h2.children.length).to.be.equal(0);

    testElement(h3, "### Baz @foo x   #", src);
    testElement(h3.title, "Baz @foo x", src);
    expect(h3.level).to.be.equal(3);
    expect(h3.children.length).to.be.equal(1);
    expect(h3.children[0].type).to.be.equal("citation");
  });

  it("Parsing inline links", async () => {
    const src = "[x](y.md)\n# xxx [  a ](b.md) yyy";
    const [inlineLink1, inlineLink2] = <MarkdownInlineLink[]>await parse(src, "inlineLink");

    testElement(inlineLink1, "[x](y.md)", src);
    testElement(inlineLink1.title!, "x", src);
    testElement(inlineLink1.path!, "y.md", src);

    testElement(inlineLink2, "[  a ](b.md)", src);
    testElement(inlineLink2.title!, "  a ", src);
    testElement(inlineLink2.path!, "b.md", src);
  });

  it("Parsing reference links", async () => {
    const src = "[foo]\n# xxx [bar][baz] yyy";
    const [referenceLink1, referenceLink2] = <MarkdownReferenceLink[]>await parse(src, "referenceLink");

    testElement(referenceLink1, "[foo]", src);
    testElement(referenceLink1.reference!, "foo", src);
    expect(referenceLink1.title).to.be.equal(null);

    testElement(referenceLink2, "[bar][baz]", src);
    testElement(referenceLink2.title!, "bar", src);
    testElement(referenceLink2.reference!, "baz", src);
  });
});
