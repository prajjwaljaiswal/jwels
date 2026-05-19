'use client';
import { Fragment } from 'react';
import { BLOCK_REGISTRY } from './index';
import type { Block, RenderContext } from './types';

interface Props {
  blocks: Block[];
  ctx: RenderContext;
  // showHidden=true keeps hidden blocks in the output (used by the editor
  // preview iframe). Default false → hidden blocks are dropped, mirroring
  // what real shoppers see.
  showHidden?: boolean;
  // When provided, hidden blocks are rendered with this wrapper instead of
  // their normal output. Used by the editor preview to overlay a "Hidden" pill.
  hiddenWrapper?: (node: React.ReactNode, block: Block) => React.ReactNode;
}

export function BlockRenderer({ blocks, ctx, showHidden, hiddenWrapper }: Props) {
  return (
    <>
      {blocks.map((b) => {
        const def = BLOCK_REGISTRY[b.type];
        if (!def) return null;
        if (b.hidden && !showHidden) return null;
        const Renderer = def.Renderer;
        const node = <Renderer settings={b.settings} ctx={ctx} />;
        if (b.hidden && hiddenWrapper) {
          return <Fragment key={b.id}>{hiddenWrapper(node, b)}</Fragment>;
        }
        if (b.hidden) {
          return (
            <div key={b.id} style={{ opacity: 0.4, position: 'relative' }} aria-label="Hidden block">
              {node}
            </div>
          );
        }
        return <Fragment key={b.id}>{node}</Fragment>;
      })}
    </>
  );
}
