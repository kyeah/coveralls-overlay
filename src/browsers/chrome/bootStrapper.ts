/// <reference path="../../../typings/tsd.d.ts"/>
import GithubWindow from '../../githubWindow'
import { OverlayWindow } from '../../overlayWindow'
import { ChromeStorage } from './chromeStorage'
import { IStorageObject } from '../../storageObject'

/**
 * Initialize overlay window instance when document is loaded.
 */
class BootStrapper {
  private static preferences: IStorageObject = null
  private overlay: OverlayWindow = null
  private storage: ChromeStorage = new ChromeStorage()
  private url: string = ''

  constructor(private context: HTMLDocument) {
    this.initialize()
  }

    private createOverlay(preferences: IStorageObject): OverlayWindow {
      if (this.overlay) {
            return this.overlay
        }
    let doc = document.getElementById('chrome-install-plugin')
    if (doc) {
      doc.style.display = 'none'
    }
    this.url = preferences.debug_url || document.URL
    if (!(this.url.indexOf('https://github.com') < 0)) {
      return new GithubWindow(preferences, this.storage)
    }
    return null
  }

  private initialize(): void {
    if (BootStrapper.preferences !== null) {
      this.setupOverlay()
      return
    }

    this.storage.loadOption((preferences: IStorageObject) => {
      BootStrapper.preferences = preferences
      this.setupOverlay()
    })
  }

  private setupOverlay(): void {
    if (!BootStrapper.preferences.overlayEnabled) {
      return
    }

    this.overlay = this.createOverlay(BootStrapper.preferences)

    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source === window &&
          event.data.type) {
          if (event.data.type === 'coveralls' || event.data.type === 'url_change') {
              this.overlay.log('::pjax-event-received')
              return this.overlay.initialize()
          }
      }
      return null
    })

    setInterval(() => {
        if (document.URL != this.url) {
            this.url = document.URL
            this.overlay = this.createOverlay(BootStrapper.preferences)
            this.overlay.log('::hashchange-event-received')
            return this.overlay.initialize()
        }
    }, 1000)

      this.injectListener()
  }

  /**
   * Inject listener script into document
   */
  private injectListener(): void {
    let listener =  '(' + function () {
      if ((<any>window).jQuery !== undefined &&
      ($('meta[property="og:site_name"]').attr('content') === 'GitHub')) {
        $(document).on('pjax:success', function () {
          window.postMessage({ type: 'coveralls' }, '*')
        })
      }
    } + ')();'
    let script = document.createElement('script')
    let element = document.head || document.documentElement

    script.textContent = listener
    element.appendChild(script)
    script.parentNode.removeChild(script)
  }
}

$(() => {
  new BootStrapper(this)
})
