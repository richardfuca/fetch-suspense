import deepEqual from 'deep-equal';
import { EventEmitter } from 'events';
import FetchCacheItem from './fetch-cache-item';

export default class FetchSuspense extends EventEmitter {
  /** The list of initalized instances */
  private static instances: FetchSuspense[] = [];
  /** The cache of fetches indexed by tag */
  private static fetchCache: { [index: string]: FetchCacheItem[] } = {};

  /**
  * Returns a FetchSuspense matching the tags given. The instnace may be a reused instance if all tags match.
  * @param tags The tags to use
  */
  static tag(tags: string | string[]): FetchSuspense {
    const matchingInstance = FetchSuspense.instances.find(instance => deepEqual(tags, instance.tags));
    return matchingInstance ? matchingInstance : new FetchSuspense(tags);
  }

  readonly tags: string[];

  /**
   * Constructs a new FetchSuspense instance, and adds it to the instances list
   * @param tags The tag(s) to use. Tags should be in an array, but a string is acceptable if there is only 1 tag.
   */
  private constructor(tags: string | string[] = ['default']) {
    super();
    this.tags = typeof tags === 'string' ? [tags] : tags;

    FetchSuspense.instances.push(this);
    this.tags.forEach((tag) => {
      if (!FetchSuspense.fetchCache[tag]) {
        FetchSuspense.fetchCache[tag] = [];
      }
    });
  }

  /**
  * Returns a FetchSuspense matching the tags given. The instnace may be a reused instance if all tags match.
  * @param tags The tags to use
  */
  tag(tags: string | string[]): FetchSuspense {
    return FetchSuspense.tag(tags);
  }

  /**
   * Checks if any one of the assigned tags is in the given tag list
   * @param tags The tags to check
   */
  private hasOneOfTheseTags(tags: string[]): boolean {
    return this.tags.some(tag => tags.includes(tag));
  }

  /**
   * Find a fetch that matches the URL
   * @param url The URL to find a matching fetch for
   */
  private findFetchURL(url: string): FetchCacheItem | undefined {
    for (let i = 0; i < this.tags.length; i += 1) {
      const tag = this.tags[i];
      const fetchItem = FetchSuspense.fetchCache[tag].find(item => item.urlEqual(url) && !item.isExpired());
      if (fetchItem) {
        return fetchItem;
      }
    }
  }

  /**
  * Find a fetch that matches the input and options
  * @param input The input to find a matching fetch for
  * @param [opts] The opts to find a matching fetch for
  */
  private findFetchItem(input: RequestInfo, opts?: RequestInit): FetchCacheItem | undefined {
    for (let i = 0; i < this.tags.length; i += 1) {
      const tag = this.tags[i];
      const fetchItem = FetchSuspense.fetchCache[tag].find(item => item.argsEqual(input, opts) && !item.isExpired());
      if (fetchItem) {
        return fetchItem;
      }
    }
  }

  /**
   * Removes expired elements from the cache
   */
  private cleanCache(): void {
    for (let i = 0; i < this.tags.length; i += 1) {
      const tag = this.tags[i];
      FetchSuspense.fetchCache[tag] = FetchSuspense.fetchCache[tag].filter(item => !item.isExpired());
    }
  }

  /**
   * A fetch that is compatible with React Suspense
   * @param input Either the url to fetch or the request options
   * @param [opts] The request options
   * @param [lifespan=0] The time this element should be in the cache in ms
   */
  fetch(input: RequestInfo, opts?: RequestInit, lifespan = 0): any {
    const existingFetchItem = this.findFetchItem(input, opts);
    if (existingFetchItem && existingFetchItem.error != null) {
      throw existingFetchItem.error;
    } else if (existingFetchItem && existingFetchItem.response != null) {
      return existingFetchItem.response;
    } else if (existingFetchItem) {
      throw existingFetchItem.fetch;
    }

    // Create a new fetch and add it to the cache since the cache doesn't have it
    const newFetchItem = new FetchCacheItem(input, opts, lifespan);
    this.tags.forEach(tag => FetchSuspense.fetchCache[tag].push(newFetchItem));
    throw newFetchItem.fetch;
  }

  /**
   * A fetch equivalent that allows usage of the the tagging/caching system
   * @param input Either the url to fetch or the request options
   * @param [opts] The request options
   * @param [lifespan=0] The time this element should be in the cache in ms
   */
  async nonReactFetch(input: RequestInfo, opts?: RequestInit, lifespan = 0): Promise<any> {
    const existingFetchItem = this.findFetchItem(input, opts);
    if (existingFetchItem) {
      return existingFetchItem.getPromise();
    }

    // Create a new fetch and add it to the cache since the cache doesn't have it
    const newFetchItem = new FetchCacheItem(input, opts, lifespan);
    this.tags.forEach(tag => FetchSuspense.fetchCache[tag].push(newFetchItem));
    return newFetchItem.getPromise();
  }

  /**
   * Returns if the URL is currently cached
   * @param url The URL to find
   */
  uriIsInCache(url: string): boolean {
    return this.findFetchURL(url) != null;
  }

  /**
   * Removes any fetches in the cache that match the URL
   * @param url The URL to remove
   */
  forceExpireURL(url: string) {
    let matchingItem = this.findFetchURL(url);
    const elementsFound = matchingItem != null;
    while (matchingItem != null) {
      matchingItem.setExpired();
      matchingItem = this.findFetchURL(url);
    }
    if (elementsFound) {
      FetchSuspense.instances.forEach(instance => instance.hasOneOfTheseTags(this.tags) ? instance.emit('elementsExpired') : null);
      this.cleanCache();
    }
  }

  /**
   * Removes any fetches in the cache that match the request input & options exactly
   * @param input Either the url to fetch or the request options
   * @param [opts] The request options
   */
  forceExpireRequest(input: RequestInfo, opts?: RequestInit) {
    let matchingItem = this.findFetchItem(input, opts);
    const elementsFound = matchingItem != null;
    while (matchingItem != null) {
      matchingItem.setExpired();
      matchingItem = this.findFetchItem(input, opts);
    }
    if (elementsFound) {
      FetchSuspense.instances.forEach(instance => instance.hasOneOfTheseTags(this.tags) ? instance.emit('elementsExpired') : null);
      this.cleanCache();
    }
  }

  /**
  * Wipes the entire fetch cache
  */
  wipeCache() {
    this.tags.forEach(tag => FetchSuspense.fetchCache[tag] = []);
    FetchSuspense.instances.forEach(instance => instance.hasOneOfTheseTags(this.tags) ? instance.emit('elementsExpired') : null);
  }
}