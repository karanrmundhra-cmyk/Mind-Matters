import type { ModelProvider, AIParseInput, AIParseOutput, AIDraftInput } from '@/ai/types';
import { aiParseOutputSchema } from '@/ai/types';
import { buildParseMessages } from '@/ai/prompts/parse';
import { extractJson } from '@/ai/json';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 20_000;

export interface GeminiConfig {
  apiKey: string;
  fastModel: string;
  strongModel: string;
}

/**
 * Google Gemini provider. Implements the same ModelProvider interface as Anthropic, so
 * the rest of the app is unchanged — selected via AI_PROVIDER=gemini. Constructed only
 * when a key is present (see ai/index.ts).
 */
export class GeminiProvider implements ModelProvider {
  readonly name = 'gemini';
  private readonly cfg: GeminiConfig;

  constructor(cfg: GeminiConfig) {
    if (!cfg.apiKey) throw new Error('GeminiProvider requires an API key');
    this.cfg = cfg;
  }

  private async call(
    model: string,
    system: string,
    user: string,
    maxTokens: number,
    json: boolean,
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE_URL}/${model}:generateContent?key=${this.cfg.apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.2,
            ...(json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (!text) throw new Error('Gemini returned no text content');
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  async parseLoop(input: AIParseInput): Promise<AIParseOutput> {
    const { system, user } = buildParseMessages(input);
    const raw = await this.call(this.cfg.fastModel, system, user, 600, true);
    const parsed = aiParseOutputSchema.safeParse(JSON.parse(extractJson(raw)));
    if (!parsed.success) {
      throw new Error(`Gemini parse output failed validation: ${parsed.error.message}`);
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
    return (await this.call(this.cfg.strongModel, system, user, 400, false)).trim();
  }
}
