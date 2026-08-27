declare module 'jstat' {
  interface Distribution {
    cdf(x: number, ...params: number[]): number;
    inv(p: number, ...params: number[]): number;
  }

  interface JStat {
    chisquare: Distribution;
    centralF: Distribution;
    normal: Distribution;
    studentt: Distribution;
    tukey: Distribution;
    mean(arr: number[]): number;
    pooledstdev(arrays: number[][]): number;
    tukeyhsd(arrays: number[][]): Array<[[number, number], number]>;
  }

  const jStat: JStat;
  export default jStat;
}
