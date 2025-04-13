import { Group, Tooltip } from "@mantine/core";
import "./sequence.css";

interface SequenceViewerProps {
  seq: string;
  firstIndex: number;
  chunkSize: number;
  handleClick: (pos: number) => void;
  getPosStyle: (pos: number) => string;
}

interface PosWithSymbol {
  pos: number;
  symbol: string;
}
interface Block {
  label: number;
  posAndSymbols: PosWithSymbol[];
}

export const SequenceViewer = ({
  seq,
  firstIndex,
  handleClick,
  getPosStyle,
  chunkSize,
}: SequenceViewerProps) => {
  const chars = [...seq];
  let blocks: Block[] = [];

  for (let i = 0; i < chars.length; i++) {
    // map to actual sequence numbering
    const curPos = i + firstIndex;
    const isBlockBoundary = (curPos - 1) % chunkSize === 0;
    if (isBlockBoundary || blocks.length === 0) {
      blocks.push({
        label: (Math.floor((curPos - 1) / chunkSize) + 1) * chunkSize,
        posAndSymbols: [],
      });
    }

    blocks[blocks.length - 1].posAndSymbols.push({
      pos: curPos,
      symbol: chars[i],
    });
  }

  return (
    <Group>
      {blocks.map((block, blockIndex) => (
        <div
          key={blockIndex}
          seq-index={block.label}
          className={
            blockIndex !== blocks.length - 1 ||
            block.posAndSymbols.length == chunkSize
              ? "sequenceblock"
              : undefined
          }
        >
          {
            // first block padding
            blockIndex === 0 ? (
              <>
                {[...Array(chunkSize - block.posAndSymbols.length)].map(
                  (_, padIdx) => (
                    <span key={padIdx}>{"\u00A0"}</span>
                  ),
                )}
              </>
            ) : null
          }
          {block.posAndSymbols.map(({ pos, symbol }) => {
            const className = getPosStyle(pos);

            return (
              <Tooltip withArrow label={`${symbol}${pos}`} key={pos}>
                <span className={className} onClick={() => handleClick(pos)}>
                  {symbol}
                </span>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </Group>
  );
};
