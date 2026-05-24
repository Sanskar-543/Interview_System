export type TurnRole = 'user' | 'assistant';

export interface Turn {
  id: string;          // trn_01j...
  sessionId: string;   // sess_01j...
  turnIndex: number;   // 0-indexed count
  role: TurnRole;
  transcript: string;
  latencyMs: number;
  createdAt: string;   // ISO 8601 UTC
}

export type SessionStatus = 'active' | 'completed' | 'failed';

export interface Session {
  id: string;          // sess_01j...
  userId: string;      // usr_01j...
  status: SessionStatus;
  turns: Turn[];
  createdAt: string;   // ISO 8601 UTC
  updatedAt: string;   // ISO 8601 UTC
}

// WebSocket Message Contract (Discriminated Union)
export type WSMessageType =
  | 'session_start'
  | 'session_started'
  | 'speech_start'
  | 'speech_end'
  | 'transcript_interim'
  | 'transcript_final'
  | 'turn_completed'
  | 'error';

export interface BaseWSMessage {
  type: WSMessageType;
  timestamp: string;   // ISO 8601 UTC
}

export interface SessionStartMessage extends BaseWSMessage {
  type: 'session_start';
  sessionId?: string;
  role?: string;
}

export interface SessionStartedMessage extends BaseWSMessage {
  type: 'session_started';
  sessionId: string;
}

export interface SpeechStartMessage extends BaseWSMessage {
  type: 'speech_start';
}

export interface SpeechEndMessage extends BaseWSMessage {
  type: 'speech_end';
}

export interface TranscriptInterimMessage extends BaseWSMessage {
  type: 'transcript_interim';
  text: string;
}

export interface TranscriptFinalMessage extends BaseWSMessage {
  type: 'transcript_final';
  text: string;
}

export interface TurnCompletedMessage extends BaseWSMessage {
  type: 'turn_completed';
  turn: Turn;
}

export interface ErrorMessage extends BaseWSMessage {
  type: 'error';
  code: string;
  message: string;
}

export type WSMessage =
  | SessionStartMessage
  | SessionStartedMessage
  | SpeechStartMessage
  | SpeechEndMessage
  | TranscriptInterimMessage
  | TranscriptFinalMessage
  | TurnCompletedMessage
  | ErrorMessage;

// Evaluation Score definitions (used in phase 3 workers)
export interface Score {
  id: string;          // rpt_01j...
  sessionId: string;   // sess_01j...
  userId: string;      // usr_01j...
  overallScore: number; // 0-100
  categories: {
    communication: number;
    technicalDepth: number;
    problemSolving: number;
    situationalFit: number;
  };
  feedback: string;
  reportUrl: string;
  createdAt: string;   // ISO 8601 UTC
}
