/**
 * lib/robot-geometry.ts
 * Screen geometry for the 3D chat robot pointing at a button: which way to face, the arm angle that aims
 * the finger at the button, where the fingertip ends up, and where the guide line should land.
 * Pure functions with no DOM access, so they are unit-tested directly.
 * Used by: components/ChatWidget.
 */

export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * How far the robot turns (around its vertical axis) to show its side while walking or pointing.
 * Not a full 90°, so a sliver of its face stays visible. The CSS reads the same value (--side-turn).
 */
export const SIDE_TURN_DEG = 75;

/** Which way to face so the robot looks at a target: towards the side the target is on. */
export function facingToward(robotCenterX: number, targetX: number): 'left' | 'right' {
  return targetX < robotCenterX ? 'left' : 'right';
}

/**
 * The arm's rotation (degrees, around the shoulder) that points the finger from `shoulder` at `target`.
 * The arm hangs straight down at 0° and swings forward (in the direction the robot faces) as the angle
 * grows: 90° points straight ahead, 180° straight up.
 * The robot is turned SIDE_TURN_DEG from the viewer, so its "forward" looks slightly shortened on screen;
 * dividing the screen distance by sin(turn) undoes that, so the finger lines up with the target.
 */
export function pointingAngle(
  shoulder: Point,
  target: Point,
  facing: 'left' | 'right',
  turnDeg: number = SIDE_TURN_DEG,
): number {
  const forwardOnScreen = facing === 'right' ? target.x - shoulder.x : shoulder.x - target.x;
  const forward = forwardOnScreen / Math.sin((turnDeg * Math.PI) / 180);
  const down = target.y - shoulder.y;
  return Math.round((Math.atan2(forward, down) * 180) / Math.PI);
}

/** Straight-line distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The point `length` pixels from `from`, heading towards `to`. Returns `from` if the two points coincide. */
export function pointAlong(from: Point, to: Point, length: number): Point {
  const total = distance(from, to);
  if (total === 0) return { ...from };
  return { x: from.x + ((to.x - from.x) / total) * length, y: from.y + ((to.y - from.y) / total) * length };
}

/** The point of a rectangle closest to `point` (the point itself if it is inside). */
export function nearestPointOnRect(point: Point, rect: Rect): Point {
  return {
    x: Math.min(Math.max(point.x, rect.left), rect.right),
    y: Math.min(Math.max(point.y, rect.top), rect.bottom),
  };
}

/** Centre of a rectangle. */
export function rectCenter(rect: Rect): Point {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}
