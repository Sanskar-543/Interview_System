import '../integration/setupEnv';
import test from 'node:test';
import assert from 'node:assert';
import { TurnOrchestrator } from '../../apps/voice-service/handlers/turn';
import { Turn, WSMessage } from '@ai-interviewer/shared';
import { STTProvider, STTStreamConfig } from '../../apps/voice-service/providers/stt';
import { LLMProvider, ChatMessage, LLMStreamConfig } from '../../apps/voice-service/providers/llm';
import { TTSProvider } from '../../apps/voice-service/providers/tts';

// Mock Providers
class MockSTT implements STTProvider {
  async start(config: STTStreamConfig): Promise<void> {}
  sendAudio(chunk: Buffer): void {}
  async stop(): Promise<void> {}
}

class MockLLM implements LLMProvider {
  async streamCompletion(messages: ChatMessage[], config: LLMStreamConfig): Promise<void> {
    config.onToken('Mocked ');
    config.onToken('response.');
    config.onComplete('Mocked response.');
  }
}

class MockTTS implements TTSProvider {
  async synthesize(text: string): Promise<Buffer> {
    return Buffer.from([1, 2, 3]);
  }
}

class MockStore {
  public turns: Turn[] = [];
  async getSession(id: string) {
    return { id, userId: 'test', status: 'active' as const, turns: this.turns, createdAt: '', updatedAt: '' };
  }
  async appendTurn(id: string, turn: Turn) {
    this.turns.push(turn);
  }
}

test('Orchestrator: Processes user speech and streams assistant response', async () => {
  const store = new MockStore();
  const sentWSMessages: WSMessage[] = [];
  const sentAudioChunks: Buffer[] = [];

  const orchestrator = new TurnOrchestrator({
    stt: new MockSTT(),
    llm: new MockLLM(),
    tts: new MockTTS(),
    store: store as any,
    sessionId: 'sess_test',
    userId: 'usr_test',
    sendWSMessage: (msg) => sentWSMessages.push(msg),
    sendAudioChunk: (buf) => sentAudioChunks.push(buf),
  });

  await orchestrator.handleUserUtterance('Hello');

  // Verify candidate turn is appended
  assert.equal(store.turns.length, 2);
  assert.equal(store.turns[0].role, 'user');
  assert.equal(store.turns[0].transcript, 'Hello');

  // Verify assistant response is appended
  assert.equal(store.turns[1].role, 'assistant');
  assert.equal(store.turns[1].transcript, 'Mocked response.');

  // Verify audio transmission succeeded
  assert.equal(sentAudioChunks.length, 1);
  assert.deepEqual(sentAudioChunks[0], Buffer.from([1, 2, 3]));
});
