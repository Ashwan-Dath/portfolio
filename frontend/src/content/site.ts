/**
 * content/site.ts
 * Your personal details, in one place. Every page reads from here, so edit this file
 * (not the components) to change your name, links or role.
 * Used by: the header, hero, footer, page metadata, the social preview image and X-ray code links.
 */
export const site = {
  // TODO(you): your name as it should appear in the header and browser tab.
  name: 'Your Name',
  // TODO(you): your job title.
  role: 'Full-Stack Developer',
  // One sentence for search engines and link previews (LinkedIn, Slack, WhatsApp).
  tagline: 'Full-stack developer. This portfolio is a working app: switch on X-ray to see how every part is built.',
  // TODO(you): the address recruiters should write to.
  email: 'you@example.com',
  // TODO(you): your GitHub profile.
  githubUrl: 'https://github.com/your-username',
  // TODO(you): your LinkedIn profile.
  linkedinUrl: 'https://www.linkedin.com/in/your-handle',
  // TODO(you): this repository on GitHub. X-ray links point at files inside it, on the `main` branch.
  repoUrl: 'https://github.com/your-username/portfolio',
  // TODO(you): the live address once Vercel has deployed the site. Used for absolute links in previews.
  siteUrl: 'https://your-portfolio.vercel.app',
  // Skills you have used in past work that this site does not run. Shown as plain text, never in X-ray.
  alsoWorkedWith: ['Java', 'MySQL', 'AWS'],
} as const;
