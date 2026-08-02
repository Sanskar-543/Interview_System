import { db, knowledge } from '@ai-interviewer/db';
import { sql } from 'drizzle-orm';
export async function searchKnowledge(embedding, role, limit = 2) {
    try {
        const embeddingString = `[${embedding.join(',')}]`;
        const similarity = sql `1 - (${knowledge.embedding} <=> ${embeddingString}::vector)`;
        const results = await db.select({
            id: knowledge.id,
            question: knowledge.question,
            idealKeywords: knowledge.idealKeywords,
            similarity,
        })
            .from(knowledge)
            .where(sql `${knowledge.role} = ${role}`)
            .orderBy(sql `${knowledge.embedding} <=> ${embeddingString}::vector`)
            .limit(limit);
        return results;
    }
    catch (err) {
        // Return empty array if vector search fails (e.g. pgvector not yet loaded during tests)
        return [];
    }
}
