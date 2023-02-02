const { performance } = require("node:perf_hooks");

const markdownIt = require("markdown-it");

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

  console.log(`Number of lines: ${src.split("\n").length}`);

  let tokens;
  const tokenizationTime = await benchmark(async () => {
    tokens = await tokenizer.tokenize("text.html.markdown", src);
  });

  let doc;
  const parsingTime = await benchmark(async () => {
    doc = markane.markdown.parseDocument("input.md").run({ offset: 0, tokens }).value;
  });

  console.log(`Tokenization time: ${tokenizationTime} ms`);
  console.log(`Number of tokens: ${tokens.length}`);
  console.log(`Parsing time: ${parsingTime} ms`);
  console.log(`Full parsing time: ${tokenizationTime + parsingTime} ms`);
  console.log(`Number of elements: ${doc.elements.length}`);

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

  console.log();

  let markdownItTokens;
  const markdownItTime = await benchmark(async () => {
    markdownItTokens = markdownIt().parse(src, {});
  });
  console.log(`(markdown-it) Tokenization time: ${markdownItTime}`);
  console.log(`(markdown-it) Number of tokens: ${markdownItTokens.length}`);
}

main();
