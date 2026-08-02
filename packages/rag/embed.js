import { env, logger } from '@ai-interviewer/shared';
export async function getEmbedding(text) {
    try {
        const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'openai/text-embedding-3-small',
                input: text.replace(/\n/g, ' '),
            }),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            logger.warn({ status: response.status, errorText }, 'RAG: OpenRouter embedding call returned non-200');
            return [];
        }
        const data = await response.json();
        if (!data.data || !data.data[0] || !data.data[0].embedding) {
            logger.warn('RAG: Invalid response structure from OpenRouter embedding API');
            return [];
        }
        return data.data[0].embedding;
    }
    catch (err) {
        logger.error({ err, text: text.slice(0, 100) }, 'RAG: Embedding generation exception');
        return [];
    }
}
