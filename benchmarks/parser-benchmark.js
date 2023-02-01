const { performance } = require("node:perf_hooks");

const markane = require("../dist");

async function benchmark(f) {
  const start = performance.now();
  await f();
  const end = performance.now();

  return end - start;
}

async function main() {
  let src = "";

  for (let i = 0; i < 200; i++) {
    src += "#".repeat(1 + (i % 4)) + " Heading " + i.toString() + "\n\n";
    for (let j = 0; j < i; j++) {
      src += `foo bar baz [x${i}](y${j}.md) qwerty\n`;
    }
  }

  const tokenizer = new markane.markdown.MarkdownTokenizer();
  await tokenizer.loadGrammar("text.html.markdown");
  const parser = new markane.markdown.MarkdownParser(tokenizer);

  console.log(`Number of lines: ${src.split("\n").length}`);

  let doc;
  const parsingTime = await benchmark(async () => {
    doc = await parser.parse("input.md", src);
  });

  console.log(`Parsing tmie: ${parsingTime} ms`);

  const elements = [];

  const searchTime = await benchmark(async () => {
    for (let i = 0; i < 100; i++) {
      for (let j = 0; j < 100; j++) {
        const element = markane.markdown.getElementAt(doc.elements, { line: i * 100, character: j }, true);
        if (element != null) {
          elements.push(element);
        }
      }
    }
  });

  console.log(`Search time: ${searchTime} ms`);
  console.log(`Number of elements: ${elements.length}`);
}

main();
