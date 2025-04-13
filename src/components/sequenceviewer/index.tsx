import { Group, Tooltip } from "@mantine/core";
import "./sequence.css";

interface SequenceViewerProps {
  seq: string;
  firstIndex: number;
  chunkSize: number;
  handleClick: (pos: number) => void;
  getPosStyle: (pos: number) => string;
}

export const SequenceViewer = ({
  seq,
  firstIndex,
  handleClick,
  getPosStyle,
  chunkSize = 10,
}: SequenceViewerProps) => {
  const chars = [...seq];
  let chunks = [];

  // TODO: update to arbitrary firstIndex
  for (let i = 0; i < chars.length; i = i + chunkSize) {
    chunks.push(chars.slice(i, i + chunkSize));
  }

  return (
    <Group>
      {chunks.map((chunk, chunkIndex) => (
        <div
          key={chunkIndex}
          seq-index={(chunkIndex + 1) * 10}
          className={chunk.length == chunkSize ? "sequenceblock" : undefined}
        >
          {chunk.map((char, posIndex) => {
            // TODO: update calculation to arbitrary first index
            const pos = chunkIndex * chunkSize + posIndex + firstIndex;
            const className = getPosStyle(pos);

            return (
              <Tooltip withArrow label={`${char}${pos}`} key={posIndex}>
                <span className={className} onClick={() => handleClick(pos)}>
                  {char}
                </span>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </Group>
  );
};
