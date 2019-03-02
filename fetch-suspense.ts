import deepEqual from 'deep-equal';

interface FetchCache {
  readonly fetch?: Promise<void>;
  error?: any;
  readonly opts: RequestInit | undefined;
  readonly input: RequestInfo;
  response?: any;
}

export default class FetchSuspense {
  private static fetchCaches: FetchCache[] = [];

  /**
   * React suspense compatiable fetch function
   * @param input Either the url to fetch or the request options
   * @param [opts] The request options
   * @param [lifespan=0] The time this element should be in the cache in ms
   */
  static fetch(input: RequestInfo, opts?: RequestInit, lifespan = 0) {
    // Is there an existing fetch in the cache?
    for (const fetchCache of this.fetchCaches) {
      if (deepEqual(input, fetchCache.input) && deepEqual(opts, fetchCache.opts)) {
        // Throw an error if the fetch failed
        if (fetchCache.error != null) {
          throw fetchCache.error;
        }
        // Return the response if the fetch succeeded
        if (fetchCache.response != null) {
          return fetchCache.response;
        }
        throw fetchCache.fetch;
      }
    }

    // Create a new fetch and add it to the cache since the cache doesn't have it
    const fetchCache: FetchCache = {
      opts,
      input,
      fetch: fetch(input, opts).then((response) => {
        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.includes('application/json')) {
          return response.json();
        } else {
          return response.text();
        }
      }).then((response) => {
        fetchCache.response = response;
      }).catch((e) => {
        fetchCache.error = e;
      }).then(() => {
        if (lifespan > 0) {
          setTimeout(() => {
            const index = this.fetchCaches.indexOf(fetchCache);
            if (index !== -1) {
              this.fetchCaches.splice(index, 1);
            }
          }, lifespan);
        }
      }),
    };
    this.fetchCaches.push(fetchCache);
    throw fetchCache.fetch;
  }

  /**
   * Returns if the URI is currently cached
   * @param uri The URI to find
   */
  static uriIsInCache(uri: string) {
    return this.fetchCaches.find(ele => ele.input instanceof Request ? ele.input.url === uri : ele.input === uri);
  }

  /**
   * Removes any fetches in the cache that match the URI
   * @param uri The URI to remove
   */
  static forceExpireURL(uri: string) {
    this.fetchCaches = this.fetchCaches.filter(ele => ele.input instanceof Request ? ele.input.url !== uri : ele.input !== uri);
  }

  /**
   * Removes any fetches in the cache that match the request input & options exactly
   * @param input Either the url to fetch or the request options
   * @param [opts] The request options
   */
  static forceExpireRequest(input: RequestInfo, opts?: RequestInit) {
    this.fetchCaches = this.fetchCaches.filter(ele => !deepEqual(input, ele.input) && !deepEqual(opts, ele.opts));
  }

  /**
  * Wipes the entire fetch cache
  */
  static wipeCache() {
    this.fetchCaches = [];
  }
}
