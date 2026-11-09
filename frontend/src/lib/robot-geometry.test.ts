/**
 * Tests for lib/robot-geometry.ts: the robot faces the button, aims its arm at it, and the guide line
 * starts at the fingertip and ends on the button's edge.
 */
import { describe, expect, it } from 'vitest';
import {
  distance,
  facingToward,
  nearestPointOnRect,
  pointAlong,
  pointingAngle,
  rectCenter,
  SIDE_TURN_DEG,
} from './robot-geometry';

describe('facingToward', () => {
  // Proves the robot turns towards whichever side the button is on.
  it('faces left for a target on the left, right otherwise', () => {
    expect(facingToward(500, 200)).toBe('left');
    expect(facingToward(500, 800)).toBe('right');
  });
});

describe('pointingAngle', () => {
  const shoulder = { x: 500, y: 500 };

  // Proves the angle convention: 0 hangs down, 90 points ahead, 180 points straight up.
  it('points straight up at a target directly above', () => {
    expect(pointingAngle(shoulder, { x: 500, y: 100 }, 'left')).toBe(180);
  });

  it('points straight ahead at a target level with the shoulder, in either direction', () => {
    expect(pointingAngle(shoulder, { x: 300, y: 500 }, 'left')).toBe(90);
    expect(pointingAngle(shoulder, { x: 700, y: 500 }, 'right')).toBe(90);
  });

  // Proves the side-turn correction: forward distance is stretched by 1/sin(turn) before taking the angle.
  it('aims up and forward at a target above and to the side', () => {
    const forward = 200 / Math.sin((SIDE_TURN_DEG * Math.PI) / 180);
    const expected = Math.round((Math.atan2(forward, -300) * 180) / Math.PI);
    expect(pointingAngle(shoulder, { x: 300, y: 200 }, 'left')).toBe(expected);
    expect(expected).toBeGreaterThan(90);
    expect(expected).toBeLessThan(180);
  });
});

describe('pointAlong and distance', () => {
  // Proves the fingertip is placed exactly one arm's length towards the target.
  it('moves the given length towards the target', () => {
    const tip = pointAlong({ x: 0, y: 0 }, { x: 30, y: 40 }, 10);
    expect(tip.x).toBeCloseTo(6);
    expect(tip.y).toBeCloseTo(8);
    expect(distance({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(50);
  });

  // Proves two identical points don't divide by zero.
  it('returns the start point when both points coincide', () => {
    expect(pointAlong({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toEqual({ x: 5, y: 5 });
  });
});

describe('nearestPointOnRect and rectCenter', () => {
  const rect = { left: 100, top: 100, right: 200, bottom: 140 };

  // Proves the guide line ends on the button's edge nearest the fingertip.
  it('clamps an outside point onto the edge', () => {
    expect(nearestPointOnRect({ x: 300, y: 300 }, rect)).toEqual({ x: 200, y: 140 });
    expect(nearestPointOnRect({ x: 150, y: 20 }, rect)).toEqual({ x: 150, y: 100 });
  });

  it('keeps a point that is already inside', () => {
    expect(nearestPointOnRect({ x: 150, y: 120 }, rect)).toEqual({ x: 150, y: 120 });
  });

  it('finds the centre', () => {
    expect(rectCenter(rect)).toEqual({ x: 150, y: 120 });
  });
});
