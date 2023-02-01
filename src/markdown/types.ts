import { Predicate } from "../utils";
import { comparePositions, isWithinRange, Position } from "../parsec/position";
import { getTokensContent, getTokensRange, HasRange, Token } from "../parsec/tokenizer";

export type MarkdownElementBase = HasRange & {
  content: string;
};

export type MarkdownInlineElement = MarkdownInlineLink | MarkdownReferenceLink | MarkdownInlineImage | MarkdownCitation;

export type MarkdownHeading = MarkdownElementBase & {
  type: "heading";
  title: MarkdownElementBase;
  level: number;
  children: MarkdownInlineElement[];
};

export type MarkdownFencedCode = MarkdownElementBase & {
  type: "fencedCode";
  language: string | null;
  code: string;
};

export type MarkdownFencedDiv = MarkdownElementBase & {
  children: MarkdownElement[];
  type: "fencedDiv";
  attributes: string; // TODO.
};

export type MarkdownInlineLink = MarkdownElementBase & {
  type: "inlineLink";
  title: MarkdownElementBase | null;
  path: MarkdownElementBase | null;
};

export type MarkdownReferenceLink = MarkdownElementBase & {
  type: "referenceLink";
  title: MarkdownElementBase | null;
  reference: MarkdownElementBase | null;
};

export type MarkdownInlineImage = MarkdownElementBase & {
  type: "inlineImage";
  title: MarkdownElementBase | null;
  path: MarkdownElementBase | null;
};

export type MarkdownCitation = MarkdownElementBase & {
  type: "citation";
  key: MarkdownElementBase;
};

export type MarkdownComment = MarkdownElementBase & {
  type: "comment";
};

export type MarkdownRaw = MarkdownElementBase & {
  type: "raw";
};

export type MarkdownFrontmatter = MarkdownElementBase & {
  type: "frontmatter";
  metadata: any;
};

export type MarkdownElement =
  | MarkdownHeading
  | MarkdownFencedCode
  | MarkdownFencedDiv
  | MarkdownInlineLink
  | MarkdownReferenceLink
  | MarkdownInlineImage
  | MarkdownCitation
  | MarkdownComment
  | MarkdownRaw
  | MarkdownFrontmatter;

export type MarkdownDocument = {
  filePath: string;
  title?: string;
  metadata: any;
  elements: MarkdownElement[];
  source?: string;
  preview?: string;
};

export function getElementChildren(e: MarkdownElement): MarkdownElement[] {
  switch (e.type) {
    case "heading":
    case "fencedDiv":
      return e.children;
    case "fencedCode":
    case "inlineLink":
    case "referenceLink":
    case "inlineImage":
    case "citation":
    case "comment":
    case "raw":
    case "frontmatter":
      return [];
  }
}

export type FoldState<T> = { acc: T; isFinished?: boolean };

export type Folder<TAcc, TValue> = (acc: TAcc, element: TValue) => FoldState<TAcc>;

export function foldElements<T>(
  f: Folder<T, MarkdownElement>,
  initial: T,
  elements: MarkdownElement | MarkdownElement[]
): T {
  if (!(elements instanceof Array)) elements = [elements];

  let acc = initial;
  for (const element of elements) {
    const { acc: acc1, isFinished } = f(acc, element);
    if (isFinished) return acc1;

    acc = acc1;
    acc = foldElements(f, acc, getElementChildren(element));
  }

  return acc;
}

export function mapElements<T>(f: (element: MarkdownElement) => T, elements: MarkdownElement | MarkdownElement[]): T[] {
  return foldElements((acc: T[], element) => ({ acc: acc.concat([f(element)]) }), [], elements);
}

export function filterElements(
  pred: Predicate<MarkdownElement>,
  elements: MarkdownElement | MarkdownElement[]
): MarkdownElement[] {
  return foldElements(
    (acc: MarkdownElement[], element) => ({
      acc: pred(element) ? acc.concat([element]) : acc,
    }),
    [],
    elements
  );
}

export function findElement(
  pred: Predicate<MarkdownElement>,
  elements: MarkdownElement | MarkdownElement[]
): MarkdownElement | null {
  return foldElements(
    (acc: MarkdownElement | null, element) =>
      pred(element) ? { acc: acc ?? element, isFinished: true } : { acc: null },
    null,
    elements
  );
}

export function elementBaseFromTokens(tokens: Token[] | null): MarkdownElementBase | null {
  if (tokens == null || tokens.length === 0) return null;
  const { start, end } = getTokensRange(tokens)!;
  const content = getTokensContent(tokens);

  return {
    content,
    start,
    end,
  };
}

export function trimElement(e: MarkdownElementBase): MarkdownElementBase {
  return {
    content: e.content.trim(),
    start: {
      line: e.start.line,
      character: e.start.character + (e.content.length - e.content.trimStart().length),
    },
    end: {
      line: e.end.line,
      character: e.end.character - (e.content.length - e.content.trimEnd().length),
    },
  };
}

export function getElementAt(
  elements: MarkdownElement[],
  pos: Position,
  narrow: boolean = true
): MarkdownElement | null {
  let startIndex = 0;
  let endIndex = elements.length - 1;
  let parent = null;

  while (startIndex <= endIndex) {
    const index = Math.round((startIndex + endIndex) / 2);
    const element = elements[index];
    const cmpStart = comparePositions(pos, element.start);
    const cmpEnd = comparePositions(pos, element.end);
    if (cmpStart < 0) {
      endIndex = index - 1;
    } else if (cmpEnd > 0) {
      startIndex = index + 1;
    } else {
      parent = element;
      break;
    }
  }

  if (parent != null && narrow) {
    const child = getElementAt(getElementChildren(parent), pos);
    if (child != null) {
      return child;
    }
  }
  return parent;
}

export function getElementsAt(elements: MarkdownElement[], pos: Position): MarkdownElement[] {
  return filterElements((e) => isWithinRange(pos, e), elements);
}
