/**
 * Dart error parser — extracts structured errors from `flutter analyze` output.
 * Reuses the same regex pattern as compilation-validator.ts.
 */

export interface DartError {
  filePath:  string;
  line:      number;
  col:       number;
  severity:  'error' | 'warning' | 'info';
  message:   string;
  errorCode?: string;
}

// Matches: lib/screens/home.dart:42:15: Error: Some message [error_code]
const DART_ERROR_REGEX =
  /^([\w/\\.-]+\.dart):(\d+):(\d+):\s*(Error|Warning|Info|Hint):\s*(.+?)(?:\s*\[(\w+)\])?$/gm;

export function parseDartErrors(output: string): DartError[] {
  const errors: DartError[] = [];
  let match: RegExpExecArray | null;
  DART_ERROR_REGEX.lastIndex = 0;

  while ((match = DART_ERROR_REGEX.exec(output)) !== null) {
    const [, filePath, line, col, severity, message, errorCode] = match;
    errors.push({
      filePath: filePath!,
      line:     parseInt(line!, 10),
      col:      parseInt(col!, 10),
      severity: (severity!.toLowerCase() as DartError['severity']),
      message:  message!.trim(),
      errorCode,
    });
  }

  return errors;
}

/** Group errors by file path for targeted repair. */
export function groupByFile(errors: DartError[]): Map<string, DartError[]> {
  const map = new Map<string, DartError[]>();
  for (const err of errors) {
    const list = map.get(err.filePath) ?? [];
    list.push(err);
    map.set(err.filePath, list);
  }
  return map;
}
