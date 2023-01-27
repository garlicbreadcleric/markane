export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };

export function isWithinRange({ line, character }: Position, { start, end }: Range): boolean {
  const startsBefore = start.line < line || (start.line == line && start.character <= character);
  const endsAfter = end.line > line || (end.line == line && end.character >= character);

  return startsBefore && endsAfter;
}
