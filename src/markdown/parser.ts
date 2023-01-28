import * as yaml from "yaml";

import { getTokensContent, getTokensRange, hasScope, Token, Tokenizer, withinLine } from "../parsec/tokenizer";
import * as parsec from "../parsec";
import { flatten, notPredicate } from "../utils";
import {
  elementBaseFromTokens,
  findElement,
  MarkdownCitation,
  MarkdownComment,
  MarkdownDocument,
  MarkdownElement,
  MarkdownFencedCode,
  MarkdownFencedDiv,
  MarkdownFrontmatter,
  MarkdownHeading,
  MarkdownInlineElement,
  MarkdownInlineImage,
  MarkdownInlineLink,
  MarkdownReferenceLink,
  trimElement,
} from "./types";
import { documentPreview } from "./preview";

const fmDashes = parsec.scoped("text.html.markdown").check((t) => t.content === "---");

const parseFrontmatter: parsec.Parser<MarkdownFrontmatter> = parsec.init
  .bind("fmBegin", fmDashes)
  .bind("fmTokens", parsec.scoped("meta.embedded.block.frontmatter").many())
  .bind("fmEnd", fmDashes)
  .chain(({ fmBegin, fmTokens, fmEnd }) => {
    const allTokens = [fmBegin, ...fmTokens, fmEnd];
    const content = getTokensContent(allTokens);
    const { start, end } = getTokensRange(allTokens)!;

    try {
      const metadata = yaml.parse(getTokensContent(fmTokens));

      return parsec.Parser.pure({
        type: "frontmatter",
        content,
        start,
        end,
        metadata,
      });
    } catch (e: any) {
      return parsec.Parser.fail(e.toString());
    }
  });

export const parseComment: parsec.Parser<MarkdownComment> = parsec
  .scoped("comment.block.html")
  .many1()
  .map((tokens) => {
    const { start, end } = getTokensRange(tokens)!;
    const content = getTokensContent(tokens);
    return {
      type: "comment",
      start,
      end,
      content,
    };
  });

export const parseInlineLink: parsec.Parser<MarkdownInlineLink> = parsec.init
  .bind("titleBegin", parsec.scoped(["punctuation.definition.link.title.begin.markdown", "meta.link.inline.markdown"]))
  .bind("titleTokens", parsec.scoped("string.other.link.title.markdown").many())
  .bind("titleEnd", parsec.scoped("punctuation.definition.link.title.end.markdown"))
  .bind(
    "pathBegin",
    parsec.scoped("punctuation.definition.metadata.markdown").check((t) => t.content === "(")
  )
  .bind("pathTokens", parsec.scoped("markup.underline.link.markdown").many())
  .bind(
    "pathEnd",
    parsec.scoped("punctuation.definition.metadata.markdown").check((t) => t.content === ")")
  )

  .map(({ titleBegin, titleTokens, titleEnd, pathBegin, pathTokens, pathEnd }) => {
    const allTokens = [titleBegin, ...titleTokens, titleEnd, pathBegin, ...pathTokens, pathEnd];

    const content = getTokensContent(allTokens);
    const { start, end } = getTokensRange(allTokens)!;

    const title = elementBaseFromTokens(titleTokens) ?? {
      content: "",
      start: titleBegin.end,
      end: titleEnd.start,
    };
    const path = elementBaseFromTokens(pathTokens) ?? {
      content: "",
      start: pathBegin.end,
      end: pathEnd.start,
    };

    return {
      type: "inlineLink",
      content,
      start,
      end,
      title,
      path,
    };
  });

export const parseShortReferenceLink: parsec.Parser<MarkdownReferenceLink> = parsec.init
  .bind("refBegin", parsec.scoped(["punctuation.definition.link.title.begin.markdown", "meta.link.reference.markdown"]))
  .bind(
    "refTokens",
    parsec
      .scoped("meta.link.reference.markdown")
      .check(notPredicate(hasScope("punctuation.definition.link.title.end.markdown")))
      .many()
  )
  .bind("refEnd", parsec.scoped("punctuation.definition.link.title.end.markdown"))

  .map(({ refBegin, refTokens, refEnd }) => {
    const allTokens = [refBegin, ...refTokens, refEnd];

    const { start, end } = getTokensRange(allTokens)!;
    const content = getTokensContent(allTokens);

    const reference = elementBaseFromTokens(refTokens);

    return {
      type: "referenceLink",
      start,
      end,
      content,
      reference,
      title: null,
    };
  });

export const parseFullReferenceLink: parsec.Parser<MarkdownReferenceLink> = parsec.init
  .bind(
    "titleBegin",
    parsec.scoped(["punctuation.definition.link.title.begin.markdown", "meta.link.reference.markdown"])
  )
  .bind(
    "titleTokens",
    parsec
      .scoped("meta.link.reference.markdown")
      .check(notPredicate(hasScope("punctuation.definition.link.title.end.markdown")))
      .many()
  )
  .bind("titleEnd", parsec.scoped("punctuation.definition.link.title.end.markdown"))
  .bind("refBegin", parsec.scoped(["meta.link.reference.markdown", "punctuation.definition.constant.begin.markdown"]))
  .bind(
    "refTokens",
    parsec
      .scoped(["meta.link.reference.markdown", "constant.other.reference.link.markdown"])
      .check(notPredicate(hasScope("punctuation.definition.constant.end.markdown")))
      .many()
  )
  .bind("refEnd", parsec.scoped("punctuation.definition.constant.end.markdown"))

  .map(({ titleBegin, titleTokens, titleEnd, refBegin, refTokens, refEnd }) => {
    const allTokens = [titleBegin, ...titleTokens, titleEnd, refBegin, ...refTokens, refEnd];
    const { start, end } = getTokensRange(allTokens)!;
    const content = getTokensContent(allTokens);

    const reference = elementBaseFromTokens(refTokens);
    const title = elementBaseFromTokens(titleTokens);

    return {
      type: "referenceLink",
      start,
      end,
      content,
      reference,
      title,
    };
  });

export const parseReferenceLink: parsec.Parser<MarkdownReferenceLink> = parsec.oneOf([
  parseFullReferenceLink,
  parseShortReferenceLink,
]);

export const parseInlineImage: parsec.Parser<MarkdownInlineImage> = parsec.init
  .bind(
    "titleBegin",
    parsec.scoped(["meta.image.inline.markdown", "punctuation.definition.link.description.begin.markdown"])
  )
  .bind(
    "titleTokens",
    parsec
      .scoped("meta.image.inline.markdown")
      .check(notPredicate(hasScope("punctuation.definition.link.description.end.markdown")))
      .many()
  )
  .bind("titleEnd", parsec.scoped("punctuation.definition.link.description.end.markdown"))
  .bind("pathBegin", parsec.scoped("punctuation.definition.metadata.markdown"))
  .bind("pathTokens", parsec.scoped("markup.underline.link.image.markdown").many())
  .bind(
    "pathEnd",
    parsec.scoped("punctuation.definition.metadata.markdown").check((t) => t.content === ")")
  )
  .map(({ titleBegin, titleTokens, titleEnd, pathBegin, pathTokens, pathEnd }) => {
    const allTokens = [titleBegin, ...titleTokens, titleEnd, pathBegin, ...pathTokens, pathEnd];

    const { start, end } = getTokensRange(allTokens)!;
    const content = getTokensContent(allTokens);

    const title = elementBaseFromTokens(titleTokens);
    const path = elementBaseFromTokens(pathTokens);

    return {
      type: "inlineImage",
      content,
      start,
      end,
      title,
      path,
    };
  });

export const parseReferenceImage = null; // TODO.

export const parseSimpleCitation: parsec.Parser<MarkdownCitation> = parsec.init
  .bind(
    "keyBegin",
    parsec
      .scoped("entity.name.citationKey")
      .check(notPredicate(hasScope("entity.name.citationKey.identifier")))
      .check((t) => t.content === "@")
  )
  .bind("keyTokens", parsec.scoped("entity.name.citationKey.identifier").many1())
  .map(({ keyBegin, keyTokens }) => {
    const allTokens = [keyBegin, ...keyTokens];
    const content = getTokensContent(allTokens);
    const { start, end } = getTokensRange(allTokens)!;

    const key = elementBaseFromTokens(keyTokens)!;

    return {
      type: "citation",
      start,
      end,
      content,
      key,
    };
  });

export const parseEscapedCitation: parsec.Parser<MarkdownCitation> = parsec.init
  .bind(
    "keyBegin",
    parsec
      .scoped("entity.name.citationKey")
      .check(notPredicate(hasScope("entity.name.citationKey.identifier")))
      .check((t) => t.content === "@{")
  )
  .bind("keyTokens", parsec.scoped("entity.name.citationKey.identifier").many1())
  .bind(
    "keyEnd",
    parsec
      .scoped("entity.name.citationKey")
      .check(notPredicate(hasScope("entity.name.citationKey.identifier")))
      .check((t) => t.content === "}")
  )
  .map(({ keyBegin, keyTokens, keyEnd }) => {
    const allTokens = [keyBegin, ...keyTokens, keyEnd];
    const content = getTokensContent(allTokens);
    const { start, end } = getTokensRange(allTokens)!;

    const key = elementBaseFromTokens(keyTokens)!;

    return {
      type: "citation",
      start,
      end,
      content,
      key,
    };
  });

export const parseCitation = parsec.oneOf([parseEscapedCitation, parseSimpleCitation]);

export const parseHeading: parsec.Parser<MarkdownHeading> = parsec.currentStartLine.chain((l) => {
  const headingDefinitionScope = "punctuation.definition.heading.markdown";
  const parseHeadingPunctuation = parsec.scoped(headingDefinitionScope);

  const parseInline = parsec.init
    .bind("start", parsec.lastEndPosition)
    .bind(
      "elementsWithContent",
      parsec.manyWithAccAndComeback(
        parsec.oneOf<MarkdownInlineElement>([parseInlineLink, parseReferenceLink, parseCitation]).check(withinLine(l)),
        parsec.takeOne.check(withinLine(l)).check(notPredicate(hasScope(headingDefinitionScope))),
        (element, s) => s + element.content,
        (token, s) => s + token.content,
        ""
      )
    )
    .bind("end", parsec.lastEndPosition)
    .map(({ start, elementsWithContent: { value: elements, acc: content }, end }) => ({
      start,
      end,
      content,
      elements,
    }));

  return parsec.init
    .bind("headingBegin", parseHeadingPunctuation.check(withinLine(l)))
    .bind("headingContent", parseInline)
    .bind("headingEnd", parseHeadingPunctuation.check(withinLine(l)).many())
    .map(({ headingBegin, headingContent, headingEnd }) => {
      const level = [1, 2, 3, 4, 5, 6].find((l) => headingBegin.scopes.includes(`heading.${l}.markdown`)) ?? 1;
      const start = headingBegin.start;
      const end =
        headingEnd != null && headingEnd.length > 0 ? headingEnd[headingEnd.length - 1].end : headingContent.end;

      return {
        type: "heading",
        start,
        end,
        content: getTokensContent([headingBegin]) + headingContent.content + getTokensContent(headingEnd),
        title: trimElement(headingContent),
        level,
        children: headingContent.elements,
      };
    });
});

export const parseFencedCode: parsec.Parser<MarkdownFencedCode> = parsec.init
  .bind("l", parsec.currentStartLine)
  .bind("beginToken", ({ l }) =>
    parsec.scoped(["markup.fenced_code.block.markdown", "punctuation.definition.markdown"]).check(withinLine(l))
  )
  .bind("junkTokens", ({ l }) =>
    parsec
      .scoped("markup.fenced_code.block.markdown")
      .check(notPredicate(hasScope("fenced_code.block.language")))
      .check(withinLine(l))
      .many()
  )
  .bind("languageToken", parsec.scoped(["markup.fenced_code.block.markdown", "fenced_code.block.language"]).try())
  .bind(
    "codeTokens",
    parsec
      .scoped("markup.fenced_code.block.markdown")
      .check(notPredicate(hasScope("punctuation.definition.markdown")))
      .many()
  )
  .bind("endToken", parsec.scoped("punctuation.definition.markdown"))
  .map(({ beginToken, junkTokens, languageToken, codeTokens, endToken }) => {
    const allTokens = [
      beginToken,
      ...junkTokens,
      ...(languageToken == null ? [] : [languageToken]),
      ...codeTokens,
      endToken,
    ];

    const { start, end } = getTokensRange(allTokens)!;
    const content = getTokensContent(allTokens);

    const language = languageToken?.content?.trim() ?? null;
    const code = getTokensContent(codeTokens);

    return {
      type: "fencedCode",
      start,
      end,
      content,
      language,
      code,
    };
  });

export const parseFencedDiv: parsec.Parser<MarkdownFencedDiv> = parsec.init
  .bind("l", parsec.currentStartLine)
  .bind("beginToken", parsec.scoped("punctuation.definition.fenced_div.begin.markdown"))
  .bind("beginJunkTokens1", ({ l }) =>
    parsec
      .scoped("markup.fenced_div.block.markdown")
      .check(withinLine(l))
      .check(notPredicate(hasScope("fenced_div.block.attributes.markdown")))
      .many()
  )
  .bind("attributesToken", ({ l }) => parsec.scoped("fenced_div.block.attributes.markdown").check(withinLine(l)).try())
  .bind("beginJunkTokens2", ({ l }) => parsec.scoped("markup.fenced_div.block.markdown").check(withinLine(l)).many())
  .bind(
    "children",
    parseElements(parsec.takeOne.check(notPredicate(hasScope("punctuation.definition.fenced_div.end.markdown"))))
  )
  .bind("endToken", parsec.scoped("punctuation.definition.fenced_div.end.markdown"))
  .map(({ beginToken, beginJunkTokens1, attributesToken, beginJunkTokens2, children, endToken }) => {
    const { start, end } = getTokensRange([beginToken, endToken])!;

    const beginTokens = [
      beginToken,
      ...beginJunkTokens1,
      ...(attributesToken == null ? [] : [attributesToken]),
      ...beginJunkTokens2,
    ];
    let content = getTokensContent(beginTokens);
    let lastLine = beginTokens.at(-1)!.end.line;

    for (const child of children) {
      if (child.start.line > lastLine) {
        content += "\n".repeat(child.start.line - lastLine);
      }
      lastLine = child.end.line;
      content += child.content;
    }

    if (endToken.start.line > lastLine) {
      content += "\n".repeat(endToken.start.line - lastLine);
    }
    content += endToken.content;

    return {
      type: "fencedDiv",
      start,
      end,
      content,
      attributes: attributesToken?.content ?? "",
      children,
    };
  });

export const parseElement: parsec.Parser<MarkdownElement> = parsec.oneOf<MarkdownElement>([
  parseFencedCode,
  parseFencedDiv,
  parseHeading,
  parseInlineLink,
  parseReferenceLink,
  parseInlineImage,
  parseCitation,
]);

export function parseElements(tokenComeback: parsec.Parser<Token> | null = null): parsec.Parser<MarkdownElement[]> {
  return parsec
    .manyWithAccAndComeback<MarkdownElement, Token, MarkdownElement[]>(
      parseElement,
      tokenComeback ?? parsec.takeOne,
      (element: MarkdownElement, acc: MarkdownElement[]) => acc.concat([element]),
      (token: Token, acc: MarkdownElement[]) => {
        if (acc.length === 0 || acc[acc.length - 1].type != "raw") {
          return acc.concat([
            {
              type: "raw",
              content: token.content,
              start: token.start,
              end: token.end,
            },
          ]);
        } else {
          const acc2 = acc.slice(0, -1);
          let previousRaw = acc[acc.length - 1];
          let content = previousRaw.content;

          if (token.start.line > previousRaw.end.line) {
            content += "\n".repeat(token.start.line - previousRaw.end.line);
          }
          content += token.content;

          acc2.push({
            type: "raw",
            content,
            start: previousRaw.start,
            end: token.end,
          });

          return acc2;
        }
      },
      []
    )
    .map(({ acc }) => acc);
}

export function parseDocument(filePath: string): parsec.Parser<MarkdownDocument> {
  return parseFrontmatter.tryWithDefault(null).chain((frontmatter) =>
    parseElements().map((elements) => {
      let title = null;
      if (frontmatter?.metadata?.title != null) {
        title = frontmatter.metadata.title;
      } else {
        const h1 = <MarkdownHeading>findElement((e) => e.type === "heading" && e.level === 1, elements);
        if (h1 != null) {
          title = h1.title.content;
        }
      }

      const elementsWithFm = frontmatter == null ? elements : [<MarkdownElement>frontmatter].concat(elements);

      return {
        filePath,
        elements: elementsWithFm,
        metadata: frontmatter?.metadata ?? {},
        title,
      };
    })
  );
}

export class MarkdownParser {
  constructor(protected tokenizer: Tokenizer) {}

  async parse(filePath: string, text: string): Promise<MarkdownDocument> {
    const tokens = flatten(await this.tokenizer.tokenize("text.html.markdown", text));
    const doc = parseDocument(filePath).parse(tokens);

    doc.filePath = filePath;
    doc.source = text;
    return doc;
  }

  // TODO: Remove preview parser entirely.
  async preview(filePath: string, text: string): Promise<string> {
    const tokens = flatten(await this.tokenizer.tokenize("text.html.markdown", text));
    const preview = documentPreview(filePath).parse(tokens);

    return preview;
  }
}
