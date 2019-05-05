import deepEqual from 'deep-equal';

export default class FetchCacheItem {
  error?: any;
  response?: any;
  private lifespan: number;
  private expired = false;
  readonly fetch: Promise<void>;
  readonly input: RequestInfo;
  readonly opts?: RequestInit;

  /**
   * Creates a new FetchCacheItem/
   *
   * Please note that constructing this class will immediately create a network request
   *
   * @param input The fetch input
   * @param opts The fetch options
   * @param [lifespan=0] The lifespan in MS, disabled by default
   */
  constructor(input: RequestInfo, opts?: RequestInit, lifespan = 0) {
    this.input = input;
    this.opts = opts;
    this.lifespan = lifespan;
    this.fetch = this.generateFetch();

    if (this.lifespan) {
      setTimeout(() => this.expired = true, this.lifespan);
    }
  }

  /**
   * Returns if the given arguments are equal to the arguments given for this fetch
   * @param input The input to check against
   * @param [opts] The options to check against
   */
  argsEqual(input: RequestInfo, opts?: RequestInit): boolean {
    return deepEqual(input, this.input) && deepEqual(opts, this.opts);
  }

  /**
   * Returns if the given URL is equal to the URL given for this fetch
   * @param url The URL to check against
   */
  urlEqual(url: string): boolean {
    return this.input instanceof Request ? this.input.url === url : this.input === url;
  }

  /**
   * Retrurns if this fetch has expired
   */
  isExpired(): boolean {
    return this.expired;
  }

  /**
   * Sets the fetch to expired
   */
  setExpired(): void {
    this.expired = true;
  }

  /**
   * Gets a promise that resolves with the response or throws if it failed
   */
  async getPromise(): Promise<any> {
    await this.fetch;
    if (this.error != null) {
      throw this.error;
    } else {
      return this.response;
    }
  }

  /**
   * Generates the fetch promise that does the actual fetch
   */
  private async generateFetch(): Promise<void> {
    try {
      const response = await fetch(this.input, this.opts);
      const contentType = response.headers.get('Content-Type') || '';
      const data = contentType.includes('application/json') ? await response.json() : await response.text();
      this.response = data;
    } catch (e) {
      this.error = e;
    }
  }
}
