import type { EntryParser, ParseContext, ParseResult } from './types';

/**
 * Extension point for a later model-backed parser (for example Gemini).
 * The prototype never calls a network and needs no API key.
 * Pass the returned parser ahead of `ruleBasedParser` in `interpretUtterance`.
 * Return null from `complete` to fall through to the rule parser.
 */
export function createLlmParser(
  complete: (text: string, context: ParseContext) => Promise<ParseResult | null>,
): EntryParser {
  return {
    id: 'llm',
    parse(text, context) {
      return complete(text, context);
    },
  };
}
