import { db, knowledge } from '@ai-interviewer/db';
import { sql } from 'drizzle-orm';

export interface RAGChunk {
  id: string;
  question: string;
  idealKeywords: string;
  similarity: number;
}

export async function searchKnowledge(embedding: number[], role: string, limit = 2): Promise<RAGChunk[]> {
  try {
    const embeddingString = `[${embedding.join(',')}]`;
    const similarity = sql<number>`1 - (${knowledge.embedding} <=> ${embeddingString}::vector)`;

    const results = await db.select({
      id: knowledge.id,
      question: knowledge.question,
      idealKeywords: knowledge.idealKeywords,
      similarity,
    })
    .from(knowledge)
    .where(sql`${knowledge.role} = ${role}`)
    .orderBy(sql`${knowledge.embedding} <=> ${embeddingString}::vector`)
    .limit(limit);

    return results as RAGChunk[];
  } catch (err) {
    // Return empty array if vector search fails (e.g. pgvector not yet loaded during tests)
    return [];
  }
}
