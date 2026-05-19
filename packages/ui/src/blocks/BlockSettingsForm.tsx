'use client';
import { BLOCK_REGISTRY } from './index';
import type { Block, EditorContext } from './types';

export function BlockSettingsForm({
  block,
  onChange,
  ctx,
}: {
  block: Block;
  onChange: (next: Block) => void;
  ctx: EditorContext;
}) {
  const def = BLOCK_REGISTRY[block.type];
  if (!def) {
    return <p className="text-sm text-ink-600">Unknown block type: {block.type}</p>;
  }
  const Editor = def.Editor;
  return (
    <Editor
      settings={block.settings}
      onChange={(next) => onChange({ ...block, settings: next })}
      ctx={ctx}
    />
  );
}
