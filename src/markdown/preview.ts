import path from "path";

import { isRelativeLink } from "../utils";
import * as parsec from "../parsec";

type PreviewContent = { content: string; lastLine: number };

function appendContent(value: PreviewContent, { content, lastLine }: PreviewContent): PreviewContent {
  if (value.lastLine > lastLine) {
    content += "\n".repeat(value.lastLine - lastLine);
  }
  content += value.content;

  return { content, lastLine: value.lastLine };
}

export function documentPreview(filePath: string): parsec.Parser<string> {
  const normalizeLink = parsec.scoped("markup.underline.link.markdown").map((t) => {
    if (isRelativeLink(t.content)) {
      const dir = path.dirname(filePath);
      return { content: path.join(dir, t.content), lastLine: t.end.line };
    }

    return { content: t.content, lastLine: t.end.line };
  });

  const skipImage = parsec
    .scoped(["meta.image.inline.markdown", "meta.image.reference.markdown"], parsec.ScopedMode.Or)
    .map((t) => ({ content: "", lastLine: t.end.line }));

  const anyToken: parsec.Parser<PreviewContent> = parsec.takeOne.map((t) => ({
    content: t.content,
    lastLine: t.end.line,
  }));

  return parsec
    .manyWithAcc(parsec.oneOf([skipImage, normalizeLink, anyToken]), appendContent, { content: "", lastLine: 0 })
    .map(({ acc: { content } }) => content);
}
