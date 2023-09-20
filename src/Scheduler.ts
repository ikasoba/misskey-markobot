type Args<F extends (...a: any[]) => any> = F extends (...a: infer A) => any ? A
  : never;

export class Scheduler {
  static executeAt<F extends (...a: any[]) => any>(
    fn: F,
    date: Date,
    ...args: Args<F>
  ) {
    return setTimeout(fn, date.getTime() - Date.now(), ...args);
  }
}
