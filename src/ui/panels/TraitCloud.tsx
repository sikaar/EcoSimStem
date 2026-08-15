import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { createTraitCloud } from '../../render/traitCloud';
import { createOrbitControls } from '../../render/orbit';
import { simRef } from '../../store/simRef';
import { useSimStore } from '../../store/simStore';

/**
 * §9.2's 3D scatter — sense × speed × urge, one dot per rabbit, rotatable,
 * with a faint trail of previous days' centroids. Own canvas and own
 * animation-frame loop, independent of the main scene's — reads live
 * per-rabbit genes via simRef (§4.1: aggregates go through simStore, but
 * per-creature data has no aggregate form to go through).
 */
const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 320,
  right: 14,
  width: 170,
  fontFamily: 'var(--mono)',
  color: 'var(--dim)',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '10px 14px 12px',
};

// Used inside StatsDrawer on mobile — see Genes.tsx's inlinePanelStyle for
// why this drops the absolute positioning.
const inlinePanelStyle: CSSProperties = {
  fontFamily: 'var(--mono)',
  color: 'var(--dim)',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 4,
  padding: '10px 14px 12px',
  width: '100%',
};

const headerStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.16em',
  color: 'var(--teal)',
  marginBottom: 6,
};

const legendStyle: CSSProperties = {
  fontSize: 9,
  color: 'var(--dim2)',
  marginTop: 6,
  textAlign: 'center',
};

export function TraitCloud({ inline = false }: { inline?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cloud = createTraitCloud(canvas);
    const controls = createOrbitControls(cloud.camera, canvas, {
      minDistance: 2,
      maxDistance: 6,
      enablePan: false,
      autoRotate: true,
      autoRotateSpeed: 0.6,
    });

    let rafId = 0;
    const frame = () => {
      const sim = simRef.current;
      if (sim) {
        cloud.updatePoints(sim.rabbits);
        cloud.updateTrail(useSimStore.getState().geneHistory);
      }
      controls.update();
      cloud.renderer.render(cloud.scene, cloud.camera);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    const resizeObserver = new ResizeObserver(cloud.resize);
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.dispose();
      cloud.dispose();
    };
  }, []);

  return (
    <div style={inline ? inlinePanelStyle : panelStyle}>
      <div style={headerStyle}>TRAIT CLOUD</div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 150, display: 'block', touchAction: 'none', cursor: 'grab' }} />
      <div style={legendStyle}>sense × speed × urge</div>
    </div>
  );
}
