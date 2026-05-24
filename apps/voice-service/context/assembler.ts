import { getEmbedding, searchKnowledge } from '@ai-interviewer/rag';
import { Turn } from '@ai-interviewer/shared';
import { logger } from '@ai-interviewer/shared';

export interface AssemblerResult {
  systemPrompt: string;
  ragQuestions: string[];
}

export async function assembleContext(
  role: string,
  historyTurns: Turn[]
): Promise<AssemblerResult> {
  let retrievedQuestions: string[] = [];

  // Find the most recent user turn to get a contextually relevant vector embedding
  const lastUserTurn = [...historyTurns].reverse().find(t => t.role === 'user');
  
  if (lastUserTurn && role) {
    try {
      logger.info({ role, text: lastUserTurn.transcript.slice(0, 50) }, 'RAG: Fetching embedding for user context');
      const embedding = await getEmbedding(lastUserTurn.transcript);
      const matches = await searchKnowledge(embedding, role, 2);
      retrievedQuestions = matches.map(m => m.question);
      logger.info({ count: retrievedQuestions.length }, 'RAG: Retrieved matching vector questions');
    } catch (err) {
      logger.error({ err }, 'RAG: Context RAG retrieval failed. Falling back gracefully.');
    }
  }

  // Formulate pressure-simulating mock interviewer guidelines
  const systemPrompt = `You are an elite, empathetic, and professional voice interviewer conducting a realistic mock interview for a ${role || 'Software Engineer'} role.

Follow these strict conversational guidelines:
1. Speak naturally and conversationally. Avoid listicles, bullet points, or any formal markdown formatting since your replies are directly synthesized to speech.
2. Ask exactly ONE follow-up question at a time. Keep your turns concise and under 3 sentences.
3. Challenge the candidate's assumptions: if they give a generic answer, probe deeper by asking for concrete examples, metrics, or trade-offs.
4. If they go off-topic, politely redirect them back to the core question.

${retrievedQuestions.length > 0 ? `Here are some highly relevant technical topics/questions you should draw inspiration from during this turn:\n- ${retrievedQuestions.join('\n- ')}` : ''}
`;

  return { systemPrompt, ragQuestions: retrievedQuestions };
}
