/**
 * lib/guide.ts
 * The small contract between the guestbook and the chat robot, so the robot can point at the Send note
 * button without the two components importing each other:
 * - the Send note button carries data-guide-target="send-note", which the robot looks for;
 * - the guestbook fires a window event when a note is sent, so the robot knows not to point any more;
 * - the robot sets data-guide-highlight="true" on the button while pointing (styled in globals.css).
 * Used by: components/Guestbook and components/ChatWidget.
 */

/** CSS selector for the button the robot points at. */
export const SEND_NOTE_SELECTOR = '[data-guide-target="send-note"]';

/** Window event fired by the guestbook when a visitor sends a note. */
export const NOTE_SENT_EVENT = 'portfolio:note-sent';

/** Attribute the robot puts on the button while pointing at it, to make it pulse. */
export const GUIDE_HIGHLIGHT_ATTR = 'data-guide-highlight';
