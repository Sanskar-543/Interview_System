import { env } from '@ai-interviewer/shared';
import { logger } from '@ai-interviewer/shared';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMStreamConfig {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
  model?: string;
}

export interface LLMProvider {
  streamCompletion(messages: ChatMessage[], config: LLMStreamConfig): Promise<void>;
}

export class OpenRouterLLMAdapter implements LLMProvider {
  async streamCompletion(messages: ChatMessage[], config: LLMStreamConfig): Promise<void> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:5000',
          'X-Title': 'AI Interviewer SaaS',
        },
        body: JSON.stringify({
          model: config.model || 'meta-llama/llama-3-8b-instruct:free', // Dynamic model parameter for backup rotation
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${errText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (!cleanedLine) continue;
          if (cleanedLine === 'data: [DONE]') continue;

          if (cleanedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(cleanedLine.slice(6));
              const token = data.choices?.[0]?.delta?.content || '';
              if (token) {
                fullText += token;
                config.onToken(token);
              }
            } catch (e) {
              logger.debug({ line, e }, 'LLM: Failed to parse stream chunk');
            }
          }
        }
      }

      config.onComplete(fullText);
    } catch (error) {
      logger.error({ error }, 'LLM: OpenRouter streaming failure');
      config.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
