import { logger } from '@ai-interviewer/shared';
export class STTNormalizer {
    static replacementRules = [
        // CS Fundamentals — DBMS
        { pattern: /\b(b\s*tree|btree)\b/gi, replacement: 'B-Tree' },
        { pattern: /\b(hash\s*index|hash\s*indexing)\b/gi, replacement: 'Hash Indexing' },
        { pattern: /\b(acid|acid\s*properties)\b/gi, replacement: 'ACID properties' },
        { pattern: /\b(mvcc|multi\s*version\s*concurrency)\b/gi, replacement: 'MVCC' },
        { pattern: /\b(n\s*plus\s*one|n\+1)\b/gi, replacement: 'N+1 query problem' },
        { pattern: /\b(read\s*replica|read\s*replicas)\b/gi, replacement: 'Read Replicas' },
        // CS Fundamentals — Computer Networks
        { pattern: /\b(tcp\s*ip|tcp\/ip|tcp)\b/gi, replacement: 'TCP/IP' },
        { pattern: /\b(udp|user\s*datagram)\b/gi, replacement: 'UDP' },
        { pattern: /\b(three\s*way\s*handshake|3\s*way\s*handshake)\b/gi, replacement: '3-way handshake' },
        { pattern: /\b(http\s*two|http\/2)\b/gi, replacement: 'HTTP/2' },
        { pattern: /\b(http\s*three|http\/3)\b/gi, replacement: 'HTTP/3' },
        { pattern: /\b(web\s*sockets|web\s*socket|websocket|websockets)\b/gi, replacement: 'WebSockets' },
        { pattern: /\b(ssl\s*tls|tls|ssl)\b/gi, replacement: 'TLS' },
        { pattern: /\b(dns|domain\s*name\s*system)\b/gi, replacement: 'DNS' },
        { pattern: /\b(cdn|content\s*delivery\s*network)\b/gi, replacement: 'CDN' },
        // CS Fundamentals — OOPs & Design Patterns
        { pattern: /\b(poly\s*morphism|polymorphism)\b/gi, replacement: 'Polymorphism' },
        { pattern: /\b(en\s*capsulation|encapsulation)\b/gi, replacement: 'Encapsulation' },
        { pattern: /\b(ab\s*straction|abstraction)\b/gi, replacement: 'Abstraction' },
        { pattern: /\b(in\s*heritance|inheritance)\b/gi, replacement: 'Inheritance' },
        { pattern: /\b(solid\s*principles|solid)\b/gi, replacement: 'SOLID principles' },
        { pattern: /\b(factory\s*pattern)\b/gi, replacement: 'Factory pattern' },
        { pattern: /\b(observer\s*pattern)\b/gi, replacement: 'Observer pattern' },
        { pattern: /\b(single\s*ton|singleton)\b/gi, replacement: 'Singleton' },
        // CS Fundamentals — OS & Concurrency
        { pattern: /\b(event\s*loop)\b/gi, replacement: 'Event Loop' },
        { pattern: /\b(dead\s*lock|deadlock)\b/gi, replacement: 'Deadlock' },
        { pattern: /\b(mu\s*tex|mutex)\b/gi, replacement: 'Mutex' },
        { pattern: /\b(sema\s*phore|semaphore)\b/gi, replacement: 'Semaphore' },
        { pattern: /\b(garbage\s*collection|gc)\b/gi, replacement: 'Garbage Collection' },
        // Web Frameworks & Tech Stack
        { pattern: /\b(next\s*js|nextjs)\b/gi, replacement: 'Next.js' },
        { pattern: /\b(express\s*js\s*s|express\s*js|expressjs)\b/gi, replacement: 'Express.js' },
        { pattern: /\b(react\s*js|reactjs)\b/gi, replacement: 'React' },
        { pattern: /\b(vue\s*js|vuejs)\b/gi, replacement: 'Vue.js' },
        { pattern: /\b(node\s*js|nodejs)\b/gi, replacement: 'Node.js' },
        { pattern: /\b(nest\s*js|nestjs)\b/gi, replacement: 'NestJS' },
        { pattern: /\b(tail\s*wind|tailwind\s*css)\b/gi, replacement: 'TailwindCSS' },
        { pattern: /\b(type\s*script|typescript)\b/gi, replacement: 'TypeScript' },
        { pattern: /\b(java\s*script|javascript)\b/gi, replacement: 'JavaScript' },
        // Databases & ORMs
        { pattern: /\b(post\s*as\s*sq\s*as|postgres\s*sql|postgre\s*sql|postgressql|postgres)\b/gi, replacement: 'PostgreSQL' },
        { pattern: /\b(my\s*sql|mysql)\b/gi, replacement: 'MySQL' },
        { pattern: /\b(mon\s*go\s*db|mongodb|mongo)\b/gi, replacement: 'MongoDB' },
        { pattern: /\b(red\s*is|redis)\b/gi, replacement: 'Redis' },
        { pattern: /\b(drizzle\s*orm|drizzle)\b/gi, replacement: 'Drizzle ORM' },
        { pattern: /\b(prisma\s*orm|prisma)\b/gi, replacement: 'Prisma' },
        // Cloud, Infra & DevOps
        { pattern: /\b(dock\s*er|docker)\b/gi, replacement: 'Docker' },
        { pattern: /\b(kuber\s*netes|k8s)\b/gi, replacement: 'Kubernetes' },
        { pattern: /\b(ren\s*der)\b/gi, replacement: 'Render' },
        { pattern: /\b(ver\s*cel)\b/gi, replacement: 'Vercel' },
        { pattern: /\b(aws|amazon\s*web\s*services)\b/gi, replacement: 'AWS' },
        // General Interview Terms
        { pattern: /\b(are\s*zoom)\b/gi, replacement: 'resume' },
        { pattern: /\b(backed\s*engineer)\b/gi, replacement: 'backend engineer' },
        { pattern: /\b(port\s*all)\b/gi, replacement: 'portal' },
    ];
    static normalize(transcript) {
        if (!transcript || typeof transcript !== 'string')
            return '';
        let cleaned = transcript.trim();
        for (const rule of this.replacementRules) {
            cleaned = cleaned.replace(rule.pattern, rule.replacement);
        }
        // Collapse multiple consecutive spaces
        cleaned = cleaned.replace(/\s+/g, ' ');
        if (cleaned !== transcript) {
            logger.info({ raw: transcript, normalized: cleaned }, 'STTNormalizer: Applied phonetic correction');
        }
        return cleaned;
    }
}
