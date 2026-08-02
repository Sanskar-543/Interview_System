import '../integration/setupEnv.js';
import test from 'node:test';
import assert from 'node:assert';
import { TurnOrchestrator } from '../../apps/voice-service/handlers/turn.js';

// Mock Providers
class MockSTT {
  async startSession(sessionId) {}
  sendAudio(audioChunk) {}
  onTurnComplete(callback) {}
  endSession() {}
}

class MockLLM {
  async streamCompletion(messages, config) {
    config.onToken('Mocked ');
    config.onToken('response.');
    config.onComplete('Mocked response.');
  }
}

class MockTTS {
  async synthesize(text) {
    return Buffer.from([1, 2, 3]);
  }
}

class MockStore {
  turns = [];
  async getSession(id) {
    return { id, userId: 'test', status: 'active', turns: this.turns, createdAt: '', updatedAt: '' };
  }
  async appendTurn(id, turn) {
    this.turns.push(turn);
  }
}

test('Orchestrator: Processes user speech and streams assistant response', async () => {
  const store = new MockStore();
  const sentWSMessages = [];
  const sentAudioChunks = [];

  const orchestrator = new TurnOrchestrator({
    stt: new MockSTT(),
    llm: new MockLLM(),
    tts: new MockTTS(),
    store: store,
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
