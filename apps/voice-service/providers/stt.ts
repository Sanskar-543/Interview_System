import WebSocket from 'ws';
import { env } from '@ai-interviewer/shared';
import { logger } from '@ai-interviewer/shared';

export interface STTStreamConfig {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError: (error: Error) => void;
}

export interface STTProvider {
  start(config: STTStreamConfig): Promise<void>;
  sendAudio(chunk: Buffer): void;
  stop(): Promise<void>;
}

export class DeepgramSTTAdapter implements STTProvider {
  private ws: WebSocket | null = null;
  private config: STTStreamConfig | null = null;

  async start(config: STTStreamConfig): Promise<void> {
    this.config = config;
    const url = 'wss://api.deepgram.com/v1/listen?model=nova-2&language=en-IN&smart_format=true&interim_results=true&encoding=linear16&sample_rate=16000';

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      },
    });

    this.ws.on('open', () => {
      logger.info('STT: Connected to Deepgram');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString());
        const transcript = response.channel?.alternatives?.[0]?.transcript || '';
        const isFinal = response.is_final || false;

        if (transcript && this.config) {
          this.config.onTranscript(transcript, isFinal);
        }
      } catch (err) {
        logger.error({ err }, 'STT: Failed to parse Deepgram message');
      }
    });

    this.ws.on('error', (error: Error) => {
      logger.error({ error }, 'STT: Deepgram socket error');
      if (this.config) {
        this.config.onError(error);
      }
    });

    this.ws.on('close', () => {
      logger.info('STT: Deepgram connection closed');
    });
  }

  sendAudio(chunk: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  async stop(): Promise<void> {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
