import { getTokensContent, getTokensRange, hasScope, Token, Tokenizer, withinLine } from "../parsec/tokenizer";
import * as parsec from "../parsec";
import { flatten, notPredicate } from "../utils";
import * as yaml from "yaml";
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

const fmDashes = parsec.scopedP("text.html.markdown").check((t) => t.content === "---");

const parseFrontmatter: parsec.Parser<MarkdownFrontmatter> = parsec.P.bind_("fmBegin", fmDashes)
  .bind_("fmTokens", parsec.scopedP("meta.embedded.block.frontmatter").many())
  .bind_("fmEnd", fmDashes)
  .do(({ fmBegin, fmTokens, fmEnd }) => {
    const allTokens = [fmBegin, ...fmTokens, fmEnd];
    const content = getTokensContent(allTokens);
    const { start, end } = getTokensRange(allTokens)!;

    try {
      const metadata = yaml.parse(getTokensContent(fmTokens));

      return parsec.Parser.pure<MarkdownFrontmatter>({
        type: "frontmatter",
        content,
        start,
        end,
        metadata,
      });
    } catch (e: any) {
      return parsec.Parser.fail<MarkdownFrontmatter>(e.toString());
    }
  })
  .makeParser({});

export const parseComment: parsec.Parser<MarkdownComment> = parsec
  .scopedP("comment.block.html")
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

export const parseInlineLink: parsec.Parser<MarkdownInlineLink> = parsec.P.bind_(
  "titleBegin",
  parsec.scopedP(["punctuation.definition.link.title.begin.markdown", "meta.link.inline.markdown"])
)
  .bind_("titleTokens", parsec.scopedP("string.other.link.title.markdown").many())
  .bind_("titleEnd", parsec.scopedP("punctuation.definition.link.title.end.markdown"))
  .bind_(
    "pathBegin",
    parsec.scopedP("punctuation.definition.metadata.markdown").check((t) => t.content === "(")
  )
  .bind_("pathTokens", parsec.scopedP("markup.underline.link.markdown").many())
  .bind_(
    "pathEnd",
    parsec.scopedP("punctuation.definition.metadata.markdown").check((t) => t.content === ")")
  )

  .do(({ titleBegin, titleTokens, titleEnd, pathBegin, pathTokens, pathEnd }) => {
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

    return parsec.Parser.pure<MarkdownInlineLink>({
      type: "inlineLink",
      content,
      start,
      end,
      title,
      path,
    });
  })
  .makeParser({});

export const parseShortReferenceLink: parsec.Parser<MarkdownReferenceLink> = parsec.P.bind_(
  "refBegin",
  parsec.scopedP(["punctuation.definition.link.title.begin.markdown", "meta.link.reference.markdown"])
)
  .bind_(
    "refTokens",
    parsec
      .scopedP("meta.link.reference.markdown")
      .check(notPredicate(hasScope("punctuation.definition.link.title.end.markdown")))
      .many()
  )
  .bind_("refEnd", parsec.scopedP("punctuation.definition.link.title.end.markdown"))

  .do(({ refBegin, refTokens, refEnd }) => {
    const allTokens = [refBegin, ...refTokens, refEnd];

    const { start, end } = getTokensRange(allTokens)!;
    const content = getTokensContent(allTokens);

    const reference = elementBaseFromTokens(refTokens);

    return parsec.Parser.pure<MarkdownReferenceLink>({
      type: "referenceLink",
      start,
      end,
      content,
      reference,
      title: null,
    });
  })
  .makeParser({});

export const parseFullReferenceLink: parsec.Parser<MarkdownReferenceLink> = parsec.P.bind_(
  "titleBegin",
  parsec.scopedP(["punctuation.definition.link.title.begin.markdown", "meta.link.reference.markdown"])
)
  .bind_(
    "titleTokens",
    parsec
      .scopedP("meta.link.reference.markdown")
      .check(notPredicate(hasScope("punctuation.definition.link.title.end.markdown")))
      .many()
  )
  .bind_("titleEnd", parsec.scopedP("punctuation.definition.link.title.end.markdown"))
  .bind_("refBegin", parsec.scopedP(["meta.link.reference.markdown", "punctuation.definition.constant.begin.markdown"]))
  .bind_(
    "refTokens",
    parsec
      .scopedP(["meta.link.reference.markdown", "constant.other.reference.link.markdown"])
      .check(notPredicate(hasScope("punctuation.definition.constant.end.markdown")))
      .many()
  )
  .bind_("refEnd", parsec.scopedP("punctuation.definition.constant.end.markdown"))

  .do(({ titleBegin, titleTokens, titleEnd, refBegin, refTokens, refEnd }) => {
    const allTokens = [titleBegin, ...titleTokens, titleEnd, refBegin, ...refTokens, refEnd];
    const { start, end } = getTokensRange(allTokens)!;
    const content = getTokensContent(allTokens);

    const reference = elementBaseFromTokens(refTokens);
    const title = elementBaseFromTokens(titleTokens);

    return parsec.Parser.pure<MarkdownReferenceLink>({
      type: "referenceLink",
      start,
      end,
      content,
      reference,
      title,
    });
  })
  .makeParser({});

export const parseReferenceLink: parsec.Parser<MarkdownReferenceLink> = parsec.oneOfP([
  parseFullReferenceLink,
  parseShortReferenceLink,
]);

export const parseInlineImage: parsec.Parser<MarkdownInlineImage> = parsec
  .seqP([
    parsec
      .scopedP(["meta.image.inline.markdown", "punctuation.definition.link.description.begin.markdown"])
      .singleton(),
    parsec
      .scopedP("meta.image.inline.markdown")
      .check(notPredicate(hasScope("punctuation.definition.link.description.end.markdown")))
      .many(),
    parsec.scopedP("punctuation.definition.link.description.end.markdown").singleton(),

    parsec.scopedP("punctuation.definition.metadata.markdown").singleton(),
    parsec.scopedP("markup.underline.link.image.markdown").many(),
    parsec
      .scopedP("punctuation.definition.metadata.markdown")
      .check((t) => t.content === ")")
      .singleton(),
  ])
  .map((tokenGroups) => {
    const [titleBegin, titleTokens, titleEnd, pathBegin, pathTokens, pathEnd] = tokenGroups;
    const allTokens = flatten(tokenGroups);

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

export const parseSimpleCitation: parsec.Parser<MarkdownCitation> = parsec
  .scopedP("entity.name.citationKey")
  .check(notPredicate(hasScope("entity.name.citationKey.identifier")))
  .check((t) => t.content === "@")
  .chain((first) =>
    parsec
      .scopedP("entity.name.citationKey.identifier")
      .many1()
      .map((keyTokens) => {
        const allTokens = [first].concat(keyTokens);
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
      })
  );
export const parseEscapedCitation: parsec.Parser<MarkdownCitation> = parsec
  .scopedP("entity.name.citationKey")
  .check(notPredicate(hasScope("entity.name.citationKey.identifier")))
  .check((t) => t.content === "@{")
  .chain((first) =>
    parsec
      .scopedP("entity.name.citationKey.identifier")
      .many1()
      .chain((keyTokens) =>
        parsec
          .scopedP("entity.name.citationKey")
          .check(notPredicate(hasScope("entity.name.citationKey.identifier")))
          .check((t) => t.content === "}")
          .map((last) => {
            const allTokens = flatten([[first], keyTokens, [last]]);
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
          })
      )
  );
export const parseCitation = parsec.oneOfP([parseEscapedCitation, parseSimpleCitation]);

export const parseHeading: parsec.Parser<MarkdownHeading> = parsec.currentStartLine.chain((l) => {
  const headingDefinitionScope = "punctuation.definition.heading.markdown";
  const parseHeadingPunctuation = parsec.scopedP(headingDefinitionScope);

  const parseInline = parsec.lastEndPosition.chain((start) =>
    parsec
      .manyWithAccAndComebackP(
        parsec.oneOfP<MarkdownInlineElement>([parseInlineLink, parseReferenceLink, parseCitation]).check(withinLine(l)),
        parsec.anyP.check(withinLine(l)).check(notPredicate(hasScope(headingDefinitionScope))),
        (element, s) => s + element.content,
        (token, s) => s + token.content,
        ""
      )
      .chain(({ value: elements, acc: content }) =>
        parsec.lastEndPosition.map((end) => ({
          start,
          end,
          content,
          elements,
        }))
      )
  );

  return parseHeadingPunctuation.check(withinLine(l)).chain((headingBegin) => {
    return parseInline.chain((headingTitle) => {
      return parseHeadingPunctuation
        .check(withinLine(l))
        .many()
        .map((headingEnd) => {
          const level = [1, 2, 3, 4, 5, 6].find((l) => headingBegin.scopes.includes(`heading.${l}.markdown`)) ?? 1;
          const start = headingBegin.start;
          const end =
            headingEnd != null && headingEnd.length > 0 ? headingEnd[headingEnd.length - 1].end : headingTitle.end;

          return {
            type: "heading",
            start,
            end,
            content: getTokensContent([headingBegin]) + headingTitle.content + getTokensContent(headingEnd),
            title: trimElement(headingTitle),
            level,
            children: headingTitle.elements,
          };
        });
    });
  });
});

export const parseFencedCode: parsec.Parser<MarkdownFencedCode> = parsec.currentStartLine
  .chain((l) =>
    parsec.seqP([
      parsec
        .scopedP(["markup.fenced_code.block.markdown", "punctuation.definition.markdown"])
        .check(withinLine(l))
        .singleton(),
      parsec
        .scopedP("markup.fenced_code.block.markdown")
        .check(notPredicate(hasScope("fenced_code.block.language")))
        .check(withinLine(l))
        .many(),

      parsec
        .scopedP(["markup.fenced_code.block.markdown", "fenced_code.block.language"])
        .singleton()
        .tryWithDefault([]),
      parsec
        .scopedP("markup.fenced_code.block.markdown")
        .check(notPredicate(hasScope("punctuation.definition.markdown")))
        .many(),
      parsec.scopedP("punctuation.definition.markdown").singleton(),
    ])
  )
  .map((tokenGroups) => {
    const [beginTokens, junkTokens, languageTokens, codeTokens, endTokens] = tokenGroups;
    const allTokens = flatten(tokenGroups);

    const { start, end } = getTokensRange(allTokens)!;
    const content = getTokensContent(allTokens);

    const language = languageTokens.length > 0 ? getTokensContent(languageTokens).trim() : null;
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

export const parseFencedDiv: parsec.Parser<MarkdownFencedDiv> = parsec.currentStartLine
  .chain((l) =>
    parsec.seqP([
      parsec.scopedP("punctuation.definition.fenced_div.begin.markdown").singleton(),
      parsec
        .scopedP("markup.fenced_div.block.markdown")
        .check(withinLine(l))
        .check(notPredicate(hasScope("fenced_div.block.attributes.markdown")))
        .many(),
      parsec.scopedP("fenced_div.block.attributes.markdown").check(withinLine(l)).singleton().tryWithDefault([]),
      parsec.scopedP("markup.fenced_div.block.markdown").check(withinLine(l)).many(),
    ])
  )
  .chain((beginTokenGroups) =>
    parseElements(parsec.anyP.check(notPredicate(hasScope("punctuation.definition.fenced_div.end.markdown")))).chain(
      (children) =>
        parsec.scopedP("punctuation.definition.fenced_div.end.markdown").map((endToken): MarkdownFencedDiv => {
          const beginTokens = flatten(beginTokenGroups);
          const attributesTokens = beginTokenGroups[2];
          const beginToken = beginTokens[0];
          const { start, end } = getTokensRange([beginToken, endToken])!;

          let content = getTokensContent(beginTokens);
          let lastLine = beginTokens[beginTokens.length - 1].end.line;

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
            attributes: getTokensContent(attributesTokens),
            children,
          };
        })
    )
  );

export const parseElement: parsec.Parser<MarkdownElement> = parsec.oneOfP<MarkdownElement>([
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
    .manyWithAccAndComebackP<MarkdownElement, Token, MarkdownElement[]>(
      parseElement,
      tokenComeback ?? parsec.anyP,
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
