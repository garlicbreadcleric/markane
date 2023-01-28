import { expect } from "chai";

import {
  filterElements,
  MarkdownElement,
  MarkdownParser,
  MarkdownTokenizer,
  Range,
} from "../src/markdown";
import { MarkdownHeading } from "../src/markdown/types";

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
      if (i >= range.end.line && j > range.end.character) continue;
      result += line[j];
    }
  }
  return result;
}

async function parse(src: string, elementType: string | null = null): Promise<MarkdownElement[]> {
  const parser = await createParser();
  const doc = await parser.parse("input.md", src);
  const elements = filterElements((e) => (elementType == null ? true : e.type === elementType), doc.elements);
  return elements;
}

describe("Parser tests", () => {
  it("Parsing headings", async () => {
    const src = "# Foo\n\n## Bar ###\n\n### Baz @foo x   #";
    const [h1, h2, h3] = <MarkdownHeading[]>await parse(src, "heading");

    expect(h1.content).to.be.equal("# Foo");
    expect(h1.content).to.be.equal(getSrcRange(h1, src));
    expect(h1.level).to.be.equal(1);
    expect(h1.title.content).to.be.equal("Foo");
    expect(h1.title.content).to.be.equal(getSrcRange(h1.title, src));
    expect(h1.children.length).to.be.equal(0);

    expect(h2.content).to.be.equal("## Bar ###");
    expect(h2.content).to.be.equal(getSrcRange(h2, src));
    expect(h2.level).to.be.equal(2);
    expect(h2.title.content).to.be.equal("Bar");
    // FIXME
    // expect(h2.title.content).to.be.equal(getSrcRange(h2.title, src));
    expect(h2.children.length).to.be.equal(0);

    expect(h3.content).to.be.equal("### Baz @foo x   #");
    expect(h3.content).to.be.equal(getSrcRange(h3, src));
    expect(h3.level).to.be.equal(3);
    expect(h3.title.content).to.be.equal("Baz @foo x");
    // FIXME
    // expect(h3.title.content).to.be.equal(getSrcRange(h3.title, src));
    expect(h3.children.length).to.be.equal(1);
    expect(h3.children[0].type).to.be.equal("citation");
  });
});
