import { env } from '@ai-interviewer/shared';
import { logger } from '@ai-interviewer/shared';

export interface TTSProvider {
  synthesize(text: string): Promise<Buffer>;
}

export class DeepgramTTSAdapter implements TTSProvider {
  async synthesize(text: string): Promise<Buffer> {
    const apiKey = env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('TTS: DEEPGRAM_API_KEY is not configured');
    }

    // aura-asteria-en is a natural, conversational female voice
    const url = 'https://api.deepgram.com/v1/speak?model=aura-asteria-en';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Deepgram TTS HTTP ${response.status}: ${errText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error({ error, text }, 'TTS: Deepgram TTS synthesis failure');
      throw error;
    }
  }
}
