import { env, logger } from '@ai-interviewer/shared';
export class MockTTSAdapter {
    async synthesize(text) {
        logger.info({ text }, 'TTS [Mock]: Synthesizing mock audio PCM buffer');
        // Return 3200 bytes of silent 16kHz 16-bit PCM audio samples
        return Buffer.alloc(3200);
    }
}
export class DeepgramTTSAdapter {
    voiceModel;
    constructor(voiceModel = 'aura-asteria-en') {
        this.voiceModel = voiceModel;
    }
    async synthesize(text) {
        const apiKey = env.DEEPGRAM_API_KEY;
        if (!apiKey || apiKey.startsWith('mock')) {
            return new MockTTSAdapter().synthesize(text);
        }
        // Clean text: strip markdown syntax, asterisks, hash tags, and emojis so voice sounds 100% human & natural
        const cleanText = text
            .replace(/[*_#`[\]()~>]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleanText) {
            return new MockTTSAdapter().synthesize(text);
        }
        const url = `https://api.deepgram.com/v1/speak?model=${this.voiceModel}&encoding=linear16&sample_rate=16000&container=none`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: cleanText }),
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Deepgram TTS HTTP ${response.status}: ${errText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
        catch (error) {
            logger.error({ error, text: cleanText }, 'TTS: Deepgram TTS synthesis failure');
            return new MockTTSAdapter().synthesize(text);
        }
    }
}
