import WebSocket from 'ws';
import { env, logger, AppError } from '@ai-interviewer/shared';

export interface STTProvider {
  startSession(sessionId: string): Promise<void>;
  sendAudio(audioChunk: Buffer): void;
  onTurnComplete(callback: (transcript: string) => void): void;
  endSession(): void;
}

export class DeepgramSTTAdapter implements STTProvider {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private transcriptBuffer = '';
  private onTurnCompleteCallback: ((transcript: string) => void) | null = null;
  private connectionError: Error | null = null;

  async startSession(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.transcriptBuffer = '';
    this.connectionError = null;

    const url = 'wss://api.deepgram.com/v2/listen?eot_threshold=0.7&eot_timeout_ms=5000&model=flux-general-en&encoding=linear16&sample_rate=16000';

    logger.info({ sessionId, url }, 'STT: Connecting to Deepgram Voice Agent API (WebSocket v2)...');

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
      },
    });

    this.ws.on('open', () => {
      logger.info({ sessionId: this.sessionId }, 'STT: Connected to Deepgram Voice Agent WebSocket');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString());
        const event = response.event;

        if (event === 'StartOfTurn') {
          logger.info({ sessionId: this.sessionId }, 'STT: [StartOfTurn] User began speaking. Clearing buffer.');
          this.transcriptBuffer = '';
        } else if (event === 'EndOfTurn') {
          const finalTranscript = this.transcriptBuffer.trim();
          logger.info({ sessionId: this.sessionId, transcript: finalTranscript }, 'STT: [EndOfTurn] User finished speaking.');
          
          if (this.onTurnCompleteCallback) {
            this.onTurnCompleteCallback(finalTranscript);
          }
          this.transcriptBuffer = '';
        } else {
          // MANDATORY REQUIREMENT 1: Handle both transcript payload structures safely
          const transcript = response.transcript || response.channel?.alternatives?.[0]?.transcript || '';
          if (transcript) {
            const clean = transcript.trim();
            if (clean) {
              this.transcriptBuffer += (this.transcriptBuffer ? ' ' : '') + clean;
              logger.debug({ sessionId: this.sessionId, partial: clean }, 'STT: Partial transcript accumulated');
            }
          }
        }
      } catch (err) {
        logger.error({ err, sessionId: this.sessionId }, 'STT: Error parsing socket message');
      }
    });

    // MANDATORY REQUIREMENT 2: Unexpected error handling
    this.ws.on('error', (error: Error) => {
      const appErr = new AppError('STT_DISCONNECTED', `STT connection lost: ${error.message || String(error)}`, 503);
      this.connectionError = appErr;
      logger.error({ err: appErr, sessionId: this.sessionId }, 'STT: Deepgram socket connection error occurred');
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      if (code !== 1000) {
        const reasonStr = reason.toString('utf-8') || 'unknown';
        const appErr = new AppError('STT_DISCONNECTED', `STT connection lost (code ${code}): ${reasonStr}`, 503);
        this.connectionError = appErr;
        logger.error({ err: appErr, sessionId: this.sessionId, code, reason: reasonStr }, 'STT: Deepgram socket closed unexpectedly');
      } else {
        logger.info({ sessionId: this.sessionId }, 'STT: Deepgram socket gracefully closed');
      }
    });
  }

  sendAudio(audioChunk: Buffer): void {
    // Propagate asynchronous connection failures instantly to prevent silent hanging
    if (this.connectionError) {
      throw this.connectionError;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new AppError('STT_DISCONNECTED', 'STT connection lost (socket is not open)', 503);
    }

    this.ws.send(audioChunk);
  }

  onTurnComplete(callback: (transcript: string) => void): void {
    this.onTurnCompleteCallback = callback;
  }

  endSession(): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
        this.ws.close(1000);
      }
      this.ws = null;
    }
    this.transcriptBuffer = '';
    this.onTurnCompleteCallback = null;
    this.connectionError = null;
  }
}
