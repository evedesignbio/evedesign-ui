export const range = (start: number, stop: number, step: number): number[] =>
  Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + i * step);
export const symmetricDifference = (a: Set<any>, b: Set<any>) => {
  const x = new Set([...a]);
  b.forEach((elem) => {
    if (x.has(elem)) {
      x.delete(elem);
    } else {
      x.add(elem);
    }
  });

  return x;
};

export const setEqual = (a: Set<any>, b: Set<any>) =>
  a.size === b.size && [...a].every((x) => b.has(x));

export const ellipsis = (text: string, maxLength: number) =>
{
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + "...";
  } else {
    return text;
  }
}