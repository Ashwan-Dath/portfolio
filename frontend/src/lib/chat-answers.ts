/**
 * lib/chat-answers.ts
 * The chat assistant's "brain" for now: scripted answers built only from content/site.ts and content/profile.ts.
 * It recognises a question's topic from keywords and answers only about you; anything else gets a polite
 * "I can only talk about ..." reply. When the AI version arrives, this stays as the fallback for when the
 * AI is unavailable.
 * Pure functions with no React, so they're unit-tested directly.
 * Used by: components/ChatWidget.
 */
import { profile } from '@/content/profile';
import { site } from '@/content/site';

export type ChatTopic = 'greeting' | 'skill' | 'stack' | 'experience' | 'projects' | 'contact' | 'demo' | 'unknown';

export type ChatReply = { topic: ChatTopic; text: string };

/** One-tap questions shown under the conversation. */
export const QUICK_QUESTIONS: ReadonlyArray<{ label: string; question: string }> = [
  { label: 'Tech stack', question: 'What is your tech stack?' },
  { label: 'Experience', question: 'Tell me about your experience.' },
  { label: 'Projects', question: 'What have you built?' },
  { label: 'Contact', question: 'How can I contact you?' },
];

/** First message of every conversation. */
export function greetingText(): string {
  return `Hello! I'm the assistant on ${site.name}'s portfolio. Want to know about ${site.name}'s tech stack, experience or projects? Pick a topic below or ask a question.`;
}

/**
 * Other ways visitors write each skill. The key is the name used in profile.ts.
 * Matching is on whole words, so "react" matches "React?" but "java" doesn't match "javascript".
 */
const SKILL_ALIASES: Record<string, string[]> = {
  HTML: ['html', 'html5'],
  CSS: ['css', 'css3'],
  JavaScript: ['javascript', 'js'],
  TypeScript: ['typescript', 'ts'],
  React: ['react', 'reactjs', 'react.js'],
  // Not plain "next": "what's next?" shouldn't be read as a question about Next.js.
  'Next.js': ['next.js', 'nextjs', 'next js'],
  'Node.js': ['node.js', 'nodejs', 'node'],
  Express: ['express', 'expressjs', 'express.js'],
  Java: ['java', 'spring', 'spring boot'],
  PostgreSQL: ['postgresql', 'postgres', 'psql'],
  MySQL: ['mysql'],
  GCP: ['gcp', 'google cloud'],
  'Cloud Run': ['cloud run'],
  AWS: ['aws', 'amazon web services'],
  Vercel: ['vercel'],
  'GitHub Actions': ['github actions', 'ci/cd', 'ci'],
};

/** Keywords for each topic, checked in this order (contact first, so "can I hire you" isn't read as experience). */
const TOPIC_KEYWORDS: ReadonlyArray<[Exclude<ChatTopic, 'skill' | 'unknown'>, string[]]> = [
  ['contact', ['contact', 'email', 'mail', 'hire', 'hiring', 'reach', 'available', 'availability', 'linkedin', 'github', 'resume', 'cv']],
  ['experience', ['experience', 'job', 'jobs', 'work history', 'worked', 'company', 'companies', 'years', 'career', 'role', 'background']],
  ['projects', ['project', 'projects', 'built', 'build', 'portfolio', 'apps', 'examples']],
  ['stack', ['stack', 'tech', 'technology', 'technologies', 'skills', 'skill', 'tools', 'languages', 'frameworks']],
  ['demo', ['demo', 'guestbook', 'note', 'x-ray', 'xray', 'how does this site work', 'this site']],
  ['greeting', ['hi', 'hello', 'hey', 'hii', 'good morning', 'good evening', 'namaste']],
];

/**
 * Lowercases the question and turns punctuation into spaces (keeping the dots, slashes and pluses inside
 * names like next.js or ci/cd), with a space at both ends so every keyword can be matched as a whole word.
 */
function normalise(question: string): string {
  const cleaned = question
    .toLowerCase()
    .replace(/[^a-z0-9.+#/\s-]/g, ' ')
    .replace(/\.(?=\s|$)/g, ' ') // a dot that ends a sentence is punctuation, not part of a name
    .replace(/\s+/g, ' ');
  return ` ${cleaned.trim()} `;
}

/** True when `keyword` appears as a whole word or phrase in the normalised text. */
function hasWord(text: string, keyword: string): boolean {
  return text.includes(` ${keyword} `);
}

/** Skills from profile.ts mentioned in the question, in profile order. */
export function findMentionedSkills(question: string): string[] {
  const text = normalise(question);
  return profile.skillAreas
    .flatMap((area) => area.skills)
    .filter((skill) => (SKILL_ALIASES[skill] ?? [skill.toLowerCase()]).some((alias) => hasWord(text, alias)));
}

/** "A, B and C". */
function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function skillAnswer(skills: string[]): string {
  const areas = profile.skillAreas.filter((area) => area.skills.some((skill) => skills.includes(skill)));
  const details = areas.map((area) => `${area.area}: ${area.detail}`).join(' ');
  return `Yes, ${list(skills)} ${skills.length === 1 ? 'is' : 'are'} part of ${site.name}'s toolkit. ${details}`;
}

function stackAnswer(): string {
  const lines = profile.skillAreas.map((area) => `${area.area}: ${list(area.skills)}.`).join(' ');
  return `${profile.intro} ${lines} Switch on X-ray (press X) to see which of these power each part of this site.`;
}

function experienceAnswer(): string {
  const jobs = profile.experience
    .map((job) => `${job.role} at ${job.company} (${job.period}). ${job.summary}`)
    .join(' ');
  return `${jobs} ${profile.availability}`;
}

function projectsAnswer(): string {
  return 'The Work section lists the projects, with a search box. The first one is this site itself: a Next.js front end with an Express API and PostgreSQL, which you can explore with X-ray mode.';
}

function contactAnswer(): string {
  return `${profile.availability} Email ${site.email}, or find ${site.name} on GitHub and LinkedIn using the links at the bottom of the page.`;
}

function demoAnswer(): string {
  return 'Leave a note in the guestbook at the top of the page and watch it travel through the browser, Next.js, the network, Express and PostgreSQL, with the time each layer took. Press X to see how every part is built.';
}

function unknownAnswer(): string {
  return `I can only answer questions about ${site.name}: tech stack, experience, projects, and how to get in touch. Try one of the topics below.`;
}

/**
 * Answers a visitor's question using only the profile. Order of checks:
 * 1. a named skill ("Do you know React?") gets a specific yes with how it's used,
 * 2. otherwise the first matching topic,
 * 3. otherwise the "I can only talk about ..." reply.
 */
export function answerQuestion(question: string): ChatReply {
  const skills = findMentionedSkills(question);
  if (skills.length > 0) return { topic: 'skill', text: skillAnswer(skills) };

  const text = normalise(question);
  const match = TOPIC_KEYWORDS.find(([, keywords]) => keywords.some((keyword) => hasWord(text, keyword)));
  switch (match?.[0]) {
    case 'contact':
      return { topic: 'contact', text: contactAnswer() };
    case 'experience':
      return { topic: 'experience', text: experienceAnswer() };
    case 'projects':
      return { topic: 'projects', text: projectsAnswer() };
    case 'stack':
      return { topic: 'stack', text: stackAnswer() };
    case 'demo':
      return { topic: 'demo', text: demoAnswer() };
    case 'greeting':
      return { topic: 'greeting', text: greetingText() };
    default:
      return { topic: 'unknown', text: unknownAnswer() };
  }
}
