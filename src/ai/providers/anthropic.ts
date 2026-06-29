import type { ModelProvider, AIParseInput, AIParseOutput, AIDraftInput } from '@/ai/types';
import { aiParseOutputSchema } from '@/ai/types';
import { buildParseMessages } from '@/ai/prompts/parse';
import { extractJson } from '@/ai/json';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const TIMEOUT_MS = 20_000;

export interface AnthropicConfig {
  apiKey: string;
  fastModel: string;
  strongModel: string;
}

/** Live provider. Constructed only when an API key is present (see ai/index.ts). */
export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic';
  private readonly cfg: AnthropicConfig;

  constructor(cfg: AnthropicConfig) {
    if (!cfg.apiKey) throw new Error('AnthropicProvider requires an API key');
    this.cfg = cfg;
  }

  private async call(model: string, system: string, user: string, maxTokens: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.cfg.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
      if (!text) throw new Error('Anthropic returned no text content');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  async parseLoop(input: AIParseInput): Promise<AIParseOutput> {
    const { system, user } = buildParseMessages(input);
    const raw = await this.call(this.cfg.fastModel, system, user, 600);
    const jsonText = extractJson(raw);
    const parsed = aiParseOutputSchema.safeParse(JSON.parse(jsonText));
    if (!parsed.success) {
      throw new Error(`Anthropic parse output failed validation: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  async draftMessage(input: AIDraftInput): Promise<string> {
    const system =
      'You draft short, warm, professional follow-up messages in the user’s voice. ' +
      'One short paragraph. No subject line. No placeholders.';
    const user = `Channel: ${input.channel}\nRecipient: ${input.ownerName}\nAsk: ${input.ask}\nTone: ${
      input.tone ?? 'friendly-professional'
    }\nWrite the message.`;
    return (await this.call(this.cfg.strongModel, system, user, 400)).trim();
  }
}
