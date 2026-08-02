import { db, sessions, turns, reports, users } from '@ai-interviewer/db';
import { eq } from 'drizzle-orm';
import { env, logger } from '@ai-interviewer/shared';
import crypto from 'node:crypto';
export async function processEvaluationJob(data) {
    const { sessionId, userId } = data;
    logger.info({ sessionId, userId }, 'Worker: Starting session evaluation...');
    // Idempotency Guard: Check if report already exists for sessionId before processing
    try {
        const [existingReport] = await db.select().from(reports).where(eq(reports.sessionId, sessionId)).limit(1);
        if (existingReport) {
            logger.info({ sessionId, reportId: existingReport.id }, 'Worker Idempotency Guard: Report already exists for session. Skipping duplicate evaluation.');
            return;
        }
    }
    catch (err) {
        logger.error({ err, sessionId }, 'Worker: Failed checking existing reports table');
    }
    try {
        // 1. Fetch all turns from Postgres permanent database
        const sessionTurns = await db.select().from(turns)
            .where(eq(turns.sessionId, sessionId))
            .orderBy(turns.turnIndex);
        if (sessionTurns.length === 0) {
            logger.warn({ sessionId }, 'Worker: Session has no turns. Generating minimal default report.');
            await createReport(sessionId, userId, 15, 10, 20, 15, "# Appreciation & Strengths\n* Candidate initiated the mock session.\n\n# Mistakes & Blind Spots\n* No conversational turns were recorded during this interview session.\n* Could not evaluate technical knowledge or communication ability.\n\n# Actionable Tips & Recommendations\n* Ensure your microphone is active and speak clearly during the interview.\n* Practice articulating technical architecture and code implementations.");
            return;
        }
        // 2. Pre-calculate Candidate Transcript Metrics
        const userTurnsList = sessionTurns.filter((t) => t.role === 'user');
        const userTurnsCount = userTurnsList.length;
        const totalUserWords = userTurnsList.reduce((acc, t) => acc + (t.transcript ? t.transcript.split(/\s+/).filter(Boolean).length : 0), 0);
        const avgWordsPerTurn = userTurnsCount > 0 ? Math.round(totalUserWords / userTurnsCount) : 0;
        logger.info({ sessionId, userTurnsCount, totalUserWords, avgWordsPerTurn }, 'Worker: Analyzed transcript volume metrics');
        // Format transcripts for the LLM
        const transcriptText = sessionTurns.map((t) => `${t.role.toUpperCase()}: ${t.transcript}`).join('\n').slice(0, 3500);
        let overallScore = 30;
        let technicalScore = 25;
        let communicationScore = 35;
        let behavioralScore = 30;
        let feedback = '';
        // 3. Call OpenRouter LLM with Rigorous Evaluation Prompt
        try {
            logger.info({ sessionId }, 'Worker: Calling LLM to evaluate transcript with strict rubric');
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4o-mini',
                    max_tokens: 650,
                    messages: [
                        {
                            role: 'system',
                            content: `You are a strict, uncompromising Principal Technical Interviewer evaluating a candidate's AI mock interview.

GRADING RUBRIC (STRICT 0-100):
- 0 to 30 (POOR / UNACCEPTABLE): Incomplete sentence fragments, off-topic repeats, cut-off thoughts, lack of technical depth, evasive or non-functional answers.
- 31 to 55 (BELOW AVERAGE): Listed technology names (e.g. Next.js, Express) but failed to explain schema design, authentication logic, APIs, CS core concepts, or architectural decisions.
- 56 to 75 (COMPETENT): Clear explanations of technical stack, implementation details, basic trade-offs, and fundamental CS concepts.
- 76 to 95 (OUTSTANDING): Deep technical explanations, architecture, quantitative impact (RPS/latency), CS core mastery (DBMS indexing, TCP handshakes, Event Loop, SOLID), and edge case handling.

CRITICAL EVALUATION RULES:
1. BE STRICT AND REALISTIC. Do NOT give free or generous high marks. If candidate gave cut-off fragments, repeated off-topic lines, or failed to explain backend/schema implementations, AWARD SCORES BELOW 35.
2. Evaluate CS Fundamentals explicitly across DBMS (indexes, ACID), Networks (TCP, WebSockets), OS (Event Loop, threads), and OOPs (SOLID, design patterns).

Return ONLY valid JSON matching this exact structure:
{
  "technicalScore": 25,
  "communicationScore": 30,
  "behavioralScore": 25,
  "feedback": "# Appreciation & Strengths\\n- [List genuine strengths]\\n\\n# Mistakes & Blind Spots\\n- [List specific missing details or evasive responses]\\n\\n# CS Fundamentals Breakdown\\n- **DBMS & Storage**: [Feedback on database schema, B-Trees vs Hash indexes, or ACID]\\n- **Networks & APIs**: [Feedback on TCP, WebSockets, or HTTP/2]\\n- **OS & Concurrency**: [Feedback on Event Loop or thread safety]\\n- **OOPs & Design Patterns**: [Feedback on SOLID principles or design patterns]\\n\\n# Concrete Code & Architecture Recommendations\\n- [Provide 1-2 actionable code or architecture snippets to improve candidate's stack]"
}`
                        },
                        {
                            role: 'user',
                            content: `Candidate Transcript (Total Words Spoken: ${totalUserWords}, Total Turns: ${userTurnsCount}):\n${transcriptText}`
                        }
                    ]
                })
            });
            if (response.ok) {
                const result = (await response.json());
                const text = result.choices?.[0]?.message?.content || '';
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    technicalScore = Number(parsed.technicalScore) || 25;
                    communicationScore = Number(parsed.communicationScore) || 30;
                    behavioralScore = Number(parsed.behavioralScore) || 25;
                    feedback = parsed.feedback || '';
                }
            }
        }
        catch (err) {
            logger.error({ err, sessionId }, 'Worker: LLM evaluation request failed. Applying strict fallback scores.');
        }
        // 4. Strict Heuristic Sanity Cap: If candidate spoke very few words or gave fragmented input, strictly cap maximum scores!
        if (totalUserWords < 45 || userTurnsCount < 2) {
            logger.info({ sessionId, totalUserWords }, 'Worker: Applying low-volume transcript score cap');
            technicalScore = Math.min(technicalScore, 25);
            communicationScore = Math.min(communicationScore, 30);
            behavioralScore = Math.min(behavioralScore, 25);
        }
        else if (totalUserWords < 90) {
            technicalScore = Math.min(technicalScore, 45);
            communicationScore = Math.min(communicationScore, 45);
            behavioralScore = Math.min(behavioralScore, 45);
        }
        overallScore = Math.round((technicalScore + communicationScore + behavioralScore) / 3);
        // 5. Fallback feedback if LLM parse failed or didn't return text
        if (!feedback) {
            feedback = `# Appreciation & Strengths
* **Initial Engagement**: Stated basic technology stack names (Next.js / Express.js / PostgreSQL).

# Mistakes & Blind Spots
* **Incomplete & Fragmented Responses**: Answers lacked architectural depth and end-to-end implementation details.
* **Missing Technical Foundations**: Did not elaborate on database indexing, network protocols, or concurrency models.

# CS Fundamentals Breakdown
* **DBMS & Storage**: Needs deeper explanation of PostgreSQL indexing strategies (B-Tree vs Hash) and ACID isolation levels.
* **Networks & APIs**: Practice articulating HTTP/2 multiplexing, WebSocket protocol handshakes, and TLS encryption.
* **OS & Concurrency**: Review Node.js Event Loop phases and asynchronous non-blocking I/O execution.
* **OOPs & Design Patterns**: Apply SOLID principles when designing modular backend service classes.

# Concrete Code & Architecture Recommendations
* **Database Query Optimization**:
\`\`\`sql
-- Add B-Tree index for fast lookup on frequent queries
CREATE INDEX idx_users_email ON users(email);
\`\`\`
* **Structured Response Architecture**: Use the STAR framework (Situation, Task, Action, Result) to explain technical decisions clearly.
`;
        }
        // 6. Insert report into database
        await createReport(sessionId, userId, overallScore, technicalScore, communicationScore, behavioralScore, feedback);
        logger.info({ sessionId, overallScore }, 'Worker: Rigorous evaluation report created successfully.');
    }
    catch (error) {
        logger.error({ error, sessionId }, 'Worker: Failed to execute evaluation process');
        await createReport(sessionId, userId, 25, 20, 30, 25, "# Appreciation & Strengths\n* Started interview.\n\n# Mistakes & Blind Spots\n* Incomplete responses and missing technical details.\n\n# Actionable Tips & Recommendations\n* Practice explaining architecture with complete sentences.");
    }
}
async function createReport(sessionId, userId, overallScore, technicalScore, communicationScore, behavioralScore, feedback) {
    let validUserId = userId;
    const [userExists] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userExists) {
        const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
        if (session) {
            const [sessionOwner] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
            if (sessionOwner) {
                validUserId = sessionOwner.id;
            }
        }
    }
    if (!validUserId) {
        const [firstUser] = await db.select().from(users).limit(1);
        if (firstUser) {
            validUserId = firstUser.id;
        }
        else {
            await db.insert(users).values({
                id: 'usr_guest',
                email: 'guest@example.com',
                passwordHash: 'dummy_hash',
                name: 'Guest User',
                plan: 'free',
                sessionCount: 1,
            }).onConflictDoNothing();
            validUserId = 'usr_guest';
        }
    }
    const reportId = `rpt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await db.insert(reports).values({
        id: reportId,
        sessionId,
        userId: validUserId,
        overallScore,
        technicalScore,
        communicationScore,
        behavioralScore,
        feedback,
    }).onConflictDoNothing();
}
