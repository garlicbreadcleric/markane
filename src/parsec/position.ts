export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };

export function isWithinRange({ line, character }: Position, { start, end }: Range): boolean {
  const startsBefore = start.line < line || (start.line == line && start.character <= character);
  const endsAfter = end.line > line || (end.line == line && end.character >= character);

  return startsBefore && endsAfter;
}

export function comparePositions(p1: Position, p2: Position): -1 | 0 | 1 {
  if (p1.line < p2.line) return -1;
  if (p1.line > p2.line) return 1;
  if (p1.character < p2.character) return -1;
  if (p1.character > p2.character) return 1;
  return 0;
}
