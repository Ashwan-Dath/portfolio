/**
 * Tests for the Stack section: every skill links to proof, and skills this site doesn't run
 * (Java, MySQL, AWS) appear only in the plain "Also worked with" line.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { site } from '@/content/site';
import { STACK_SKILLS, StackSection } from './StackSection';

describe('StackSection', () => {
  // Proves every skill points at this page or at the repository, never at nothing.
  it('links every skill to proof on the page or in the repo', () => {
    for (const skill of STACK_SKILLS) {
      expect(skill.href.startsWith('#') || skill.href.startsWith(site.repoUrl), `${skill.name}: ${skill.href}`).toBe(true);
    }
  });

  // Proves the page never presents Java, MySQL or AWS as running here.
  it('lists Java, MySQL and AWS only under "Also worked with"', () => {
    render(<StackSection demo={false} />);
    const also = screen.getByText(/Also worked with/);
    for (const name of ['Java', 'MySQL', 'AWS']) {
      expect(also).toHaveTextContent(name);
      // Exact names: "JavaScript" legitimately contains the letters "Java".
      expect(STACK_SKILLS.some((skill) => skill.name === name)).toBe(false);
    }
  });

  // Proves demo mode is honest about the parts that need the API.
  it('tags API skills in demo mode only', () => {
    const { unmount } = render(<StackSection demo />);
    const apiSkills = STACK_SKILLS.filter((skill) => skill.requiresApi).length;
    expect(screen.getAllByText('Arrives with the API')).toHaveLength(apiSkills);
    unmount();

    render(<StackSection demo={false} />);
    expect(screen.queryByText('Arrives with the API')).toBeNull();
  });
});
