/**
 * Tests for lib/chat-answers.ts: the assistant recognises skills and topics, and stays on the subject of you.
 */
import { describe, expect, it } from 'vitest';
import { site } from '@/content/site';
import { answerQuestion, findMentionedSkills, QUICK_QUESTIONS } from './chat-answers';

describe('findMentionedSkills', () => {
  // Proves common spellings and punctuation are understood.
  it.each([
    ['Do you know React?', ['React']],
    ['Have you used nextjs or postgres?', ['Next.js', 'PostgreSQL']],
    ['node.js and express', ['Node.js', 'Express']],
    ['Any Spring Boot experience?', ['Java']],
  ])('%s → %j', (question, skills) => {
    expect(findMentionedSkills(question)).toEqual(skills);
  });

  // Proves whole-word matching: "javascript" is not "java", and "what's next" is not Next.js.
  it('matches whole words only', () => {
    expect(findMentionedSkills('I love javascript')).toEqual(['JavaScript']);
    expect(findMentionedSkills("What's next?")).toEqual([]);
  });
});

describe('answerQuestion', () => {
  // Proves a named skill gets a specific yes with how it's used.
  it('answers a skill question', () => {
    const reply = answerQuestion('Do you know React?');
    expect(reply.topic).toBe('skill');
    expect(reply.text).toContain('React');
  });

  // Proves every quick-topic button gets its own answer, never the fallback.
  it.each(QUICK_QUESTIONS.map((item) => [item.label, item.question]))('%s button gets an answer', (_label, question) => {
    expect(answerQuestion(question).topic).not.toBe('unknown');
  });

  it('routes topics', () => {
    expect(answerQuestion('How can I contact you?').topic).toBe('contact');
    expect(answerQuestion('Tell me about your experience.').topic).toBe('experience');
    expect(answerQuestion('What have you built?').topic).toBe('projects');
    expect(answerQuestion('What is your tech stack?').topic).toBe('stack');
    expect(answerQuestion('hi there').topic).toBe('greeting');
  });

  // Proves the contact answer gives the real address from site.ts.
  it('includes the email in the contact answer', () => {
    expect(answerQuestion('Can I hire you?').text).toContain(site.email);
  });

  // Proves off-topic questions get the "I can only talk about ..." reply instead of an invented answer.
  it('stays on topic for anything else', () => {
    const reply = answerQuestion('What is the capital of France?');
    expect(reply.topic).toBe('unknown');
    expect(reply.text).toContain(`I can only answer questions about ${site.name}`);
  });
});
