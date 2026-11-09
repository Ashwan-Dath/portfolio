/**
 * components/ChatWidget/Robot3D.tsx
 * The chat assistant's 3D robot, built from real 3D boxes with CSS 3D transforms (no images, no 3D library).
 * Every body part is a box with six shaded faces, and the limbs are jointed like a person's:
 * hip → thigh → knee → shin → foot, and shoulder → upper arm → elbow → forearm → glove → finger.
 * CSS animates the joints for a natural walk cycle, waving, pointing and a set of moves (dance, karate,
 * flex, robot dance, star jumps, spin). The whole robot turns in 3D: it faces you at a slight angle when it
 * stands and talks, and shows its side when it walks or points.
 * Purely visual: the button around it (in ChatWidget) handles clicks and the accessible name.
 * Used by: components/ChatWidget.
 */
import type { CSSProperties, ReactNode } from 'react';
import { SIDE_TURN_DEG } from '@/lib/robot-geometry';
import styles from './Robot3D.module.css';

/** offstage: hidden before arriving; walking: entering; greeting: waving hello; idle: roaming and chatting. */
export type RobotPhase = 'offstage' | 'walking' | 'greeting' | 'idle';

/** front: facing the visitor; left/right: side view, looking where it walks or points. */
export type RobotFacing = 'front' | 'left' | 'right';

/** A move it can perform at a stop ('none' = no move). Durations live in ChatWidget's ACTS list. */
export type RobotAct = 'none' | 'dance' | 'karate' | 'flex' | 'robot' | 'jump' | 'spin';

type Robot3DProps = {
  phase: RobotPhase;
  /** True while it walks somewhere during idle (walk cycle). */
  moving: boolean;
  facing: RobotFacing;
  /** True while its speech bubble shows a line (mouth moves, head nods). */
  talking: boolean;
  /** Arm angle in degrees while pointing (see lib/robot-geometry.ts), or null when not pointing. */
  pointAngle: number | null;
  /** The move it is performing right now. */
  act: RobotAct;
};

type BoxProps = {
  /** Width, height and depth in pixels. */
  w: number;
  h: number;
  d: number;
  /** Centre position relative to its parent joint, in pixels (x right, y down, z towards the viewer). */
  at?: [number, number, number];
  /** Hang from the joint: the box's top edge sits at `at` instead of its centre (for limb segments). */
  hang?: boolean;
  /** Colour class (navy, orange, cream, yellow). */
  tone: string;
  /** Marks the box for measuring from ChatWidget (the fingertips). */
  part?: string;
  /** Decoration drawn on the front face (eyes, chest screen) and on both side faces (ear bolts). */
  front?: ReactNode;
  side?: ReactNode;
};

/**
 * One 3D box: a container with six faces, each turned and pushed out to its side of the box.
 * The face classes in the CSS handle the geometry and the shading.
 */
function Box({ w, h, d, at = [0, 0, 0], hang = false, tone, part, front, side }: BoxProps) {
  const style = {
    '--w': `${w}px`,
    '--h': `${h}px`,
    '--d': `${d}px`,
    '--x': `${at[0]}px`,
    '--y': `${at[1]}px`,
    '--z': `${at[2]}px`,
  } as CSSProperties;
  return (
    <div className={`${styles.box} ${hang ? styles.hang : ''} ${tone}`} style={style} data-part={part}>
      <div className={`${styles.face} ${styles.front}`}>{front}</div>
      <div className={`${styles.face} ${styles.back}`} />
      <div className={`${styles.face} ${styles.right}`}>{side}</div>
      <div className={`${styles.face} ${styles.left}`}>{side}</div>
      <div className={`${styles.face} ${styles.top}`} />
      <div className={`${styles.face} ${styles.bottom}`} />
    </div>
  );
}

type JointProps = {
  at: [number, number, number];
  /** Class of the inner layer that animations rotate (e.g. styles.kneeL). */
  className: string;
  /** Adds a zero-size marker at the joint so ChatWidget can find it on screen (the shoulders). */
  marker?: string;
  children: ReactNode;
};

/** A joint: positioned at `at`, with an inner "swing" layer that CSS rotates. */
function Joint({ at, className, marker, children }: JointProps) {
  const style = { '--px': `${at[0]}px`, '--py': `${at[1]}px`, '--pz': `${at[2]}px` } as CSSProperties;
  return (
    <div className={styles.pivot} style={style}>
      {marker && <span className={styles.marker} data-shoulder={marker} />}
      <div className={`${styles.swing} ${className}`}>{children}</div>
    </div>
  );
}

/** An arm: upper arm from the shoulder, forearm from the elbow, then a glove with a pointing finger. */
function Arm({ side, x }: { side: 'left' | 'right'; x: number }) {
  const left = side === 'left';
  return (
    <Joint at={[x, -61, 0]} className={left ? styles.armL : styles.armR} marker={side}>
      <Box w={9} h={12} d={9} hang tone={styles.navy} />
      <Joint at={[0, 12, 0]} className={left ? styles.elbowL : styles.elbowR}>
        <Box w={8} h={10} d={8} hang tone={styles.navy} />
        <Box w={11} h={11} d={11} at={[0, 15.5, 0]} tone={styles.cream} />
        <Box w={4} h={8} d={4} at={[0, 25, 0]} tone={styles.cream} part={`finger-${side}`} />
      </Joint>
    </Joint>
  );
}

/** A leg: thigh from the hip, shin from the knee, and a long foot that shows nicely from the side. */
function Leg({ side, x }: { side: 'left' | 'right'; x: number }) {
  const left = side === 'left';
  return (
    <Joint at={[x, -33, 0]} className={left ? styles.legL : styles.legR}>
      <Box w={10} h={12} d={10} hang tone={styles.navy} />
      <Joint at={[0, 12, 0]} className={left ? styles.kneeL : styles.kneeR}>
        <Box w={9} h={12} d={9} hang tone={styles.navy} />
        <Box w={12} h={7} d={17} at={[0, 16, 3]} tone={styles.navy} />
      </Joint>
    </Joint>
  );
}

export function Robot3D({ phase, moving, facing, talking, pointAngle, act }: Robot3DProps) {
  const pointing = pointAngle !== null;
  const style = {
    '--side-turn': `${SIDE_TURN_DEG}deg`,
    ...(pointing ? { '--point-angle': `${pointAngle}deg` } : {}),
  } as CSSProperties;

  return (
    <div className={styles.scaler} aria-hidden="true">
      <div
        className={styles.stage}
        style={style}
        data-robot=""
        data-phase={phase}
        data-moving={moving}
        data-facing={facing}
        data-talking={talking}
        data-pointing={pointing}
        data-act={act}
      >
        <div className={styles.shadow} />
        <div className={styles.walker}>
          <div className={styles.rig}>
            <div className={styles.bob}>
              <Leg side="left" x={-8} />
              <Leg side="right" x={8} />

              <Box
                w={36}
                h={32}
                d={24}
                at={[0, -49, 0]}
                tone={styles.orange}
                front={
                  <span className={styles.chest}>
                    <span className={styles.chestLight} />
                    <span className={styles.chestLight} />
                  </span>
                }
              />

              <Arm side="left" x={-23} />
              <Arm side="right" x={23} />

              <Box w={12} h={6} d={12} at={[0, -68, 0]} tone={styles.navy} />

              {/* The head turns at the neck, so it can nod, look around and tilt. */}
              <Joint at={[0, -70, 0]} className={styles.headSwing}>
                <Box
                  w={40}
                  h={30}
                  d={30}
                  at={[0, -15, 0]}
                  tone={styles.cream}
                  front={
                    <>
                      <span className={styles.visor}>
                        <span className={styles.eye} />
                        <span className={styles.eye} />
                      </span>
                      <span className={styles.cheekL} />
                      <span className={styles.cheekR} />
                      <span className={styles.smile} />
                      <span className={styles.mouth} />
                    </>
                  }
                  side={<span className={styles.ear} />}
                />
                <Box w={3} h={10} d={3} at={[0, -35, 0]} tone={styles.navy} />
                <Box w={7} h={7} d={7} at={[0, -43, 0]} tone={`${styles.yellow} ${styles.bulb}`} />
              </Joint>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
