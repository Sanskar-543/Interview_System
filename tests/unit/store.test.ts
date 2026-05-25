import '../integration/setupEnv';
import test from 'node:test';
import assert from 'node:assert';
import { TurnOrchestrator } from '../../apps/voice-service/handlers/turn';
import { Turn } from '@ai-interviewer/shared';
import { STTProvider } from '../../apps/voice-service/providers/stt';
import { LLMProvider, ChatMessage, LLMStreamConfig } from '../../apps/voice-service/providers/llm';
import { TTSProvider } from '../../apps/voice-service/providers/tts';

class MockSTT implements STTProvider {
  async startSession(sessionId: string): Promise<void> {}
  sendAudio(audioChunk: Buffer): void {}
  onTurnComplete(callback: (transcript: string) => void): void {}
  endSession(): void {}
}

class MockLLM implements LLMProvider {
  async streamCompletion(messages: ChatMessage[], config: LLMStreamConfig): Promise<void> {
    config.onToken('Synthesized sentence.');
    config.onComplete('Synthesized sentence.');
  }
}

class MockTTS implements TTSProvider {
  async synthesize(): Promise<Buffer> {
    return Buffer.from([1, 2, 3]);
  }
}

test('Write-Ahead: Ensures Redis writes happen strictly before audio sent', async () => {
  const callSequence: string[] = [];

  const mockStore = {
    turns: [] as Turn[],
    async getSession(id: string) {
      return { id, userId: 'test', status: 'active' as const, turns: this.turns, createdAt: '', updatedAt: '' };
    },
    async appendTurn(id: string, turn: Turn) {
      this.turns.push(turn);
      callSequence.push(`REDIS_WRITE:${turn.role}`);
    }
  };

  const orchestrator = new TurnOrchestrator({
    stt: new MockSTT(),
    llm: new MockLLM(),
    tts: new MockTTS(),
    store: mockStore as any,
    sessionId: 'sess_test',
    userId: 'usr_test',
    sendWSMessage: () => {},
    sendAudioChunk: () => {
      callSequence.push('AUDIO_SENT');
    },
  });

  await orchestrator.handleUserUtterance('Hello');

  // Verify write sequence
  const assistantWriteIndex = callSequence.indexOf('REDIS_WRITE:assistant');
  const audioSentIndex = callSequence.indexOf('AUDIO_SENT');

  assert.ok(assistantWriteIndex !== -1, 'Redis write for assistant should occur');
  assert.ok(audioSentIndex !== -1, 'Audio chunk transmission should occur');
  assert.ok(
    assistantWriteIndex < audioSentIndex, 
    `Write-Ahead Violation: Redis write (index ${assistantWriteIndex}) did not happen before audio sent (index ${audioSentIndex})`
  );
});
