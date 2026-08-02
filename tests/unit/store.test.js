import '../integration/setupEnv.js';
import test from 'node:test';
import assert from 'node:assert';
import { TurnOrchestrator } from '../../apps/voice-service/handlers/turn.js';

class MockSTT {
  async startSession(sessionId) {}
  sendAudio(audioChunk) {}
  onTurnComplete(callback) {}
  endSession() {}
}

class MockLLM {
  async streamCompletion(messages, config) {
    config.onToken('Synthesized sentence.');
    config.onComplete('Synthesized sentence.');
  }
}

class MockTTS {
  async synthesize() {
    return Buffer.from([1, 2, 3]);
  }
}

test('Write-Ahead: Ensures Redis writes happen strictly before audio sent', async () => {
  const callSequence = [];

  const mockStore = {
    turns: [],
    async getSession(id) {
      return { id, userId: 'test', status: 'active', turns: this.turns, createdAt: '', updatedAt: '' };
    },
    async appendTurn(id, turn) {
      this.turns.push(turn);
      callSequence.push(`REDIS_WRITE:${turn.role}`);
    }
  };

  const orchestrator = new TurnOrchestrator({
    stt: new MockSTT(),
    llm: new MockLLM(),
    tts: new MockTTS(),
    store: mockStore,
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
