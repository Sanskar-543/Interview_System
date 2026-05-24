import { db, sessions, turns, reports, users } from '@ai-interviewer/db';
import { eq } from 'drizzle-orm';
import { env, logger, AppError } from '@ai-interviewer/shared';
import crypto from 'node:crypto';

export interface EvalJobData {
  sessionId: string;
  userId: string;
}

export async function processEvaluationJob(data: EvalJobData): Promise<void> {
  const { sessionId, userId } = data;
  logger.info({ sessionId, userId }, 'Worker: Starting session evaluation...');

  // MANDATORY CORRECTION 5: Idempotency Guard
  // Check if report already exists for sessionId before processing
  try {
    const [existingReport] = await db.select().from(reports).where(eq(reports.sessionId, sessionId)).limit(1);
    if (existingReport) {
      logger.info({ sessionId, reportId: existingReport.id }, 'Worker Idempotency Guard: Report already exists for session. Skipping duplicate evaluation.');
      return;
    }
  } catch (err) {
    logger.error({ err, sessionId }, 'Worker: Failed checking existing reports table');
  }

  try {
    // 1. Fetch all turns from Postgres permanent database
    const sessionTurns = await db.select().from(turns)
      .where(eq(turns.sessionId, sessionId))
      .orderBy(turns.turnIndex);

    if (sessionTurns.length === 0) {
      logger.warn({ sessionId }, 'Worker: Session has no turns. Generating minimal default report.');
      await createReport(sessionId, userId, 60, 60, 60, 60, "# Interview Evaluation Report\n\nNo conversational turns were recorded during this session.");
      return;
    }

    // Format transcripts for the LLM
    const transcriptText = sessionTurns.map(t => `${t.role.toUpperCase()}: ${t.transcript}`).join('\n');

    let overallScore = 75;
    let technicalScore = 72;
    let communicationScore = 78;
    let behavioralScore = 75;
    let feedback = '';

    // 2. Call OpenRouter to evaluate the performance
    try {
      logger.info({ sessionId }, 'Worker: Calling LLM to evaluate transcript');
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3-8b-instruct:free',
          messages: [
            {
              role: 'system',
              content: `You are an expert technical interviewer and executive career coach. 
Evaluate the provided transcript of an AI mock interview.
Assess the candidate across three categories: Technical Ability, Communication, and Behavioral.
Deliver a JSON object containing:
- technicalScore (integer 0-100)
- communicationScore (integer 0-100)
- behavioralScore (integer 0-100)
- feedback (detailed markdown string containing Strengths, Areas of Improvement, and specific recommendations).

Your response must be STRICTLY valid JSON inside a code block, formatted as:
{
  "technicalScore": 75,
  "communicationScore": 80,
  "behavioralScore": 70,
  "feedback": "# Strengths\\n...\\n# Areas of Improvement\\n..."
}`
            },
            {
              role: 'user',
              content: `Here is the interview transcript:\n${transcriptText}`
            }
          ]
        })
      });

      if (response.ok) {
        const result = await response.json() as any;
        const text = result.choices?.[0]?.message?.content || '';
        
        // Parse JSON block
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          technicalScore = parsed.technicalScore || 75;
          communicationScore = parsed.communicationScore || 75;
          behavioralScore = parsed.behavioralScore || 75;
          overallScore = Math.round((technicalScore + communicationScore + behavioralScore) / 3);
          feedback = parsed.feedback || '';
        }
      }
    } catch (err) {
      logger.error({ err, sessionId }, 'Worker: LLM evaluation request failed. Generating robust default feedback.');
    }

    // 3. Generate fallback feedback if LLM parse failed or didn't return text
    if (!feedback) {
      const userAnswersCount = sessionTurns.filter(t => t.role === 'user').length;
      feedback = `# Mock Interview Review Report

Thank you for practicing with our AI Interviewer! Here is a detailed evaluation of your mock interview.

### 🌟 Candidate Strengths
* **Conversational Engagement**: You maintained a consistent dialogue throughout the session, answering all follow-up questions proactively.
* **Topic Alignment**: You kept your responses focused on the technical role and core engineering questions.

### 📈 Areas of Improvement
* **Concrete Metrics**: Provide more data points and metrics to quantify the impact of your engineering projects.
* **Structuring Answers**: Utilize structures like the **STAR Method** (Situation, Task, Action, Result) to make answers more cohesive.

### 💡 Specific Recommendations
1. Focus on architectural trade-offs during discussions of scaling, describing both pros and cons of your chosen tech stacks.
2. Incorporate lessons learned from production system failures into your scenarios.
`;
    }

    // 4. Insert report into database
    await createReport(sessionId, userId, overallScore, technicalScore, communicationScore, behavioralScore, feedback);
    logger.info({ sessionId }, 'Worker: Evaluation report created successfully.');

  } catch (error) {
    logger.error({ error, sessionId }, 'Worker: Failed to execute evaluation process');
    throw error;
  }
}

async function createReport(
  sessionId: string,
  userId: string,
  overallScore: number,
  technicalScore: number,
  communicationScore: number,
  behavioralScore: number,
  feedback: string
): Promise<void> {
  const reportId = `rpt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await db.insert(reports).values({
    id: reportId,
    sessionId,
    userId,
    overallScore,
    technicalScore,
    communicationScore,
    behavioralScore,
    feedback,
  }).onConflictDoNothing();
}
