import { env } from '@ai-interviewer/shared';
import { logger } from '@ai-interviewer/shared';

export interface TTSProvider {
  synthesize(text: string): Promise<Buffer>;
}

export class GoogleTTSAdapter implements TTSProvider {
  async synthesize(text: string): Promise<Buffer> {
    const apiKey = env.GOOGLE_TTS_API_KEY;
    if (!apiKey) {
      throw new Error('TTS: GOOGLE_TTS_API_KEY is not configured');
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'en-IN',
            name: 'en-IN-Neural2-A',
          },
          audioConfig: {
            audioEncoding: 'LINEAR16',
            speakingRate: 1.0,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google TTS HTTP ${response.status}: ${errText}`);
      }

      const data = (await response.json()) as { audioContent?: string };
      if (!data.audioContent) {
        throw new Error('Google TTS response missing audioContent');
      }

      return Buffer.from(data.audioContent, 'base64');
    } catch (error) {
      logger.error({ error, text }, 'TTS: Google TTS synthesis failure');
      throw error;
    }
  }
}
