export class TemporaryCache {
  private cache = new Map<string, [Date, number, Response]>();

  set(key: string, response: Response, expiresIn = 30 * 60 * 1000) {
    this.cache.set(key, [new Date(), expiresIn, response.clone()]);
  }

  get(key: string) {
    const c = this.cache.get(key);
    if (c == null) return null;

    const [date, expiresIn, res] = c;
    if (Date.now() - date.getTime() > expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return res.clone();
  }

  has(key: string) {
    const c = this.cache.get(key);
    if (c == null) return false;

    const [date, expiresIn] = c;
    if (Date.now() - date.getTime() > expiresIn) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}
