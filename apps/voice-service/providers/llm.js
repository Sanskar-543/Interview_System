import { env } from '@ai-interviewer/shared';
import { logger } from '@ai-interviewer/shared';
export class OpenRouterLLMAdapter {
    async streamCompletion(messages, config) {
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
                    model: config.model && config.model !== 'default' ? config.model : 'qwen/qwen-2.5-72b-instruct',
                    messages,
                    stream: true,
                    max_tokens: 60,
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
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const cleanedLine = line.trim();
                    if (!cleanedLine)
                        continue;
                    if (cleanedLine === 'data: [DONE]')
                        continue;
                    if (cleanedLine.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(cleanedLine.slice(6));
                            const token = data.choices?.[0]?.delta?.content || '';
                            if (token) {
                                fullText += token;
                                config.onToken(token);
                            }
                        }
                        catch (e) {
                            logger.debug({ line, e }, 'LLM: Failed to parse stream chunk');
                        }
                    }
                }
            }
            config.onComplete(fullText);
        }
        catch (error) {
            logger.error({ error }, 'LLM: OpenRouter streaming failure');
            config.onError(error instanceof Error ? error : new Error(String(error)));
        }
    }
}
