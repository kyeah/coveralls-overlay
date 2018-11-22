/// <reference path="../typings/tsd.d.ts"/>
import { IStorageObject } from './storageObject'
import { ISyncStorage } from './syncStorage'
import * as Rx from 'rx'
import Observable = Rx.Observable

export enum pageType { blob, compare, pull, commit, blame, tree }
export enum lineType { missed, hit, irrelevant }

export abstract class OverlayWindow {
  protected static baseUrl: string = 'https://coveralls.io/builds'
  protected static emptyCoverage: JSON = JSON.parse('{}')
  protected filePath: string = null
  protected commitSha: string = null
  protected baseSha: string = null
  protected page: pageType = null
  protected owner: string = null
  protected coverageAvailable: boolean = false
  protected invalidating: boolean = false
  protected coverage: { [key: string]: JSON; } = { }

  protected abstract acquireReference(value: string[]): string
  protected abstract prepareOverlay(): void
  protected abstract visualizeOverlay(value: any): void

  constructor(protected preferences: IStorageObject, private storage: ISyncStorage) {
    this.initialize()
  }

  log(title: string, data?: any): void {
    if (!this.preferences.debugEnabled) {
        //return;
    }

    data ? console.log(title, data) : console.log(title)
  }

  initialize(): void {
    this.preferences.setupUrl(document.URL)
    let href = (this.preferences.debug_url || document.URL).split('/')
    this.log('::initialize', href)

    this.owner = `${href[3]}/${href[4]}`
    this.page = (<any>pageType)[href[5]]
    this.commitSha = this.acquireReference(href)

    if (this.commitSha) {
      this.invalidateOverlay()
    }
  }

  private retrieveCoverageObservable(id: string): Observable<JSON> {
    this.log('::retrieveCoverage', id)
    this.coverageAvailable = false

    
    this.log('::retrieveCoverage', url)

    let settings: JQueryAjaxSettings
    settings = {
      type: 'get',
      dataType: 'json'
    }

    return Rx.Observable.fromPromise($.when($.ajax(url, settings)))
  }

  private readCoverageObservable(id: string): Observable<JSON> {
    const stored = this.coverage[id]
    if (stored) {
      return Observable.of(stored)
    }

    let observable = Observable.fromCallback<any>(this.storage.loadCoverage)
    return observable(this.coverage, id).map(x => {
      if (!x) {
        return this.retrieveCoverageObservable(id)
      } else {
        return x
      }
    }).concatAll()
  }

  protected invalidateOverlay(): void {
    if (this.invalidating) {
      this.log('::invalidateOverlay', 'invalidate ongoing')
      return
    }

    let id = this.commitSha
    this.log('::invalidateOverlay', 'invalidating')
    this.invalidating = true

    const visualize: (coverage: JSON) => void = (coverage: JSON) => {
      this.log('::visualize', 'saving coverage')

      const converters = {
          'json': (coverage) => {
              return Object.keys(coverage['statementMap'])
                  .map(i => [coverage['statementMap'][i], coverageMap['s'][i]])
                  .reduce((map: Object, [statement, s]) => {
                      map[statement.start.line] = s
                      return map
                  }, {})
          }
      }

      this.coverage[id] = converters['json'](coverage)
      this.storage.saveCoverage(this.coverage, () => { })
      this.visualizeOverlay(this.coverage[id])
    }

    this.readCoverageObservable(id).finally(() => {
        this.invalidating = false
    }).subscribe(visualize,
      (err: JQueryXHR) => {
        if (err.status === 500) {
          visualize(OverlayWindow.emptyCoverage)
        }
    })
  }

  protected static ratio(hit: number, total: number): string {
    if (hit >= total) {
      return '100'
    } else if (total > hit && hit > 0) {
      return ((hit / total) * 10000 / 100).toFixed(2)
    }
    return '0'
  }
}
