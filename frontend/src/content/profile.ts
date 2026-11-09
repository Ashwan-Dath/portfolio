/**
 * content/profile.ts
 * Everything the chat assistant is allowed to say about you: your summary, skills, experience and availability.
 * Today the assistant builds its answers from this file directly (lib/chat-answers.ts). When the AI version
 * is added, this same file becomes the AI's only source of facts, so keeping it accurate keeps the bot honest.
 *
 * TODO(you): replace the placeholder text with your real details.
 */

/** One group of skills, with a plain sentence about how you use them. */
export type SkillArea = {
  area: string;
  /** Names exactly as visitors would type them; lib/chat-answers.ts also knows common spellings. */
  skills: string[];
  detail: string;
};

/** One job or engagement. */
export type ExperienceItem = {
  role: string;
  company: string;
  period: string;
  summary: string;
};

/** The shape of the profile, so a typo in a field name is caught by TypeScript. */
export type Profile = {
  intro: string;
  skillAreas: SkillArea[];
  experience: ExperienceItem[];
  availability: string;
};

export const profile: Profile = {
  // TODO(you): two sentences about who you are and what you build.
  intro:
    'A full-stack developer who builds web apps end to end: React and Next.js interfaces, Node.js and Express APIs, and SQL databases, deployed to the cloud.',

  skillAreas: [
    {
      area: 'Front end',
      skills: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js'],
      detail:
        'Builds fast, accessible interfaces with React and Next.js (App Router, Server Components, route handlers), styled with plain CSS.',
    },
    {
      area: 'Back end',
      skills: ['Node.js', 'Express', 'Java'],
      detail: 'Writes REST APIs in Node.js with Express, with validation, rate limiting and tests, and has also built services in Java.',
    },
    {
      area: 'Databases',
      skills: ['PostgreSQL', 'MySQL'],
      detail: 'Designs schemas and queries in PostgreSQL and MySQL, including indexes and full-text search.',
    },
    {
      area: 'Cloud and delivery',
      skills: ['GCP', 'Cloud Run', 'AWS', 'Vercel', 'GitHub Actions'],
      detail:
        'Deploys containers to Google Cloud Run and front ends to Vercel, has worked with AWS, and automates tests and deploys with GitHub Actions.',
    },
  ],

  // TODO(you): your real roles, newest first.
  experience: [
    {
      role: 'Full-Stack Developer',
      company: 'Company name',
      period: '2024 to now',
      summary: 'Placeholder. Replace this with what you built there and the difference it made.',
    },
  ],

  // TODO(you): what you're looking for.
  availability: 'Open to full-stack developer roles.',
};
