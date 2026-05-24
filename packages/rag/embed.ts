import { env, logger, AppError } from '@ai-interviewer/shared';

export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nomic-ai/nomic-embed-text-v1.5',
        input: text.replace(/\n/g, ' '),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`OpenRouter HTTP error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    
    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      throw new Error('Invalid response structure from OpenRouter embedding API');
    }

    return data.data[0].embedding;
  } catch (err: any) {
    logger.error({ err, text: text.slice(0, 100) }, 'RAG: Embedding generation failed');
    throw new AppError('EMBEDDING_FAILED', 'Could not generate embedding', 500);
  }
}
