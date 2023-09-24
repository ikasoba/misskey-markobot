export const randomChoice = <T, D>(table: [T, number][], defaultValue: D) => {
  table = table.sort((x, y) => y[1] - x[1]);

  const rnd = Math.random() * table.reduce((p, c) => p + c[1], 0);
  for (const [item, p] of table) {
    if (rnd <= p) {
      return item;
    }
  }

  return table.at(-1)?.[0] ?? defaultValue;
};
