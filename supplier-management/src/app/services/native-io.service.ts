import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Native-aware replacements for the two browser affordances a Capacitor WebView
 * does NOT provide: opening a URL in a real browser, and saving a generated file.
 *
 * Why this exists
 * ───────────────
 * The same Angular code runs in a desktop tab and inside the native shell, but
 * two very common web patterns are silent no-ops in a WebView:
 *
 *  1. `window.open(url, '_blank')`
 *     Android WebView only honours this when `setSupportMultipleWindows(true)`
 *     is paired with an `onCreateWindow` implementation. Capacitor's
 *     BridgeWebChromeClient implements neither, so the call returns null and
 *     nothing happens. On iOS WKWebView, `createWebViewWith:` is likewise not
 *     implemented, so the window is never created. The user taps and sees
 *     nothing at all — no error, no navigation.
 *
 *  2. `<a download>` + `URL.createObjectURL(blob)`
 *     The `download` attribute is a browser-chrome feature, not a WebView one.
 *     Android WebView routes downloads through a `DownloadListener`, and there
 *     is no `setDownloadListener` call anywhere in @capacitor/android — so the
 *     anchor click does nothing. iOS WKWebView needs a `WKDownloadDelegate`
 *     (iOS 14.5+), which @capacitor/ios does not install either. Again: a
 *     completely silent failure.
 *
 * Both methods below keep the exact web behaviour on web (`isNativePlatform()`
 * is false → original code path, unchanged) and only diverge natively.
 */
@Injectable({ providedIn: 'root' })
export class NativeIoService {

  readonly isNative = Capacitor.isNativePlatform();

  /**
   * Opens an external URL. On native this uses the system in-app browser
   * (Chrome Custom Tab on Android, SFSafariViewController on iOS) — a real
   * browser with its own chrome and a back affordance, so the user can return
   * to the app. Falls back to `window.open` on web.
   *
   * NOTE: only http(s) URLs work natively. `blob:` and `file:` URLs belong to
   * the WebView's own origin and are unreadable by the external browser
   * process — use `saveOrShare()` for generated content instead.
   */
  async openExternal(url: string): Promise<void> {
    if (!this.isNative) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    await Browser.open({ url });
  }

  /**
   * Delivers generated content to the user.
   *
   * Web: unchanged `<a download>` behaviour.
   * Native: writes the file to the app's cache directory and opens the system
   * share sheet, which is the only way a sandboxed app can hand a file to the
   * user (Save to Files / Drive, mail it, print it, open in another app).
   *
   * @returns true if the file was delivered (or the share sheet was shown).
   *          false means it genuinely failed and the caller should say so —
   *          important for the ZK certificate, where a silent failure means
   *          permanent, unrecoverable data loss.
   */
  async saveOrShare(
    blob: Blob,
    filename: string,
    opts: { title?: string; dialogTitle?: string } = {}
  ): Promise<boolean> {
    if (!this.isNative) {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href    = url;
      a.download = filename;
      a.click();
      // Revoking synchronously can race the download in some browsers; a short
      // delay costs nothing and removes the race.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return true;
    }

    try {
      const base64 = await this.blobToBase64(blob);

      // Directory.Cache is mapped by the FileProvider declared in
      // AndroidManifest.xml (<cache-path>), so the resulting URI can actually
      // be granted to the receiving app. Writing to Directory.Documents would
      // produce a URI the share sheet cannot read on Android.
      const written = await Filesystem.writeFile({
        path:      filename,
        data:      base64,
        directory: Directory.Cache,
      });

      await Share.share({
        title:       opts.title ?? filename,
        url:         written.uri,
        dialogTitle: opts.dialogTitle ?? 'Guardar o compartir',
      });

      return true;
    } catch (err) {
      // A user dismissing the share sheet also lands here on some platforms;
      // callers treat false as "not confirmed" rather than "definitely lost".
      console.error('[NativeIo] saveOrShare failed:', err);
      return false;
    }
  }

  /**
   * Writes text content to a cache file and shares it. Same contract as
   * saveOrShare, but skips the base64 round-trip for text payloads.
   */
  async saveOrShareText(
    text: string,
    filename: string,
    opts: { title?: string; dialogTitle?: string } = {}
  ): Promise<boolean> {
    if (!this.isNative) {
      return this.saveOrShare(new Blob([text], { type: 'text/plain' }), filename, opts);
    }

    try {
      const written = await Filesystem.writeFile({
        path:      filename,
        data:      text,
        directory: Directory.Cache,
        encoding:  Encoding.UTF8,
      });

      await Share.share({
        title:       opts.title ?? filename,
        url:         written.uri,
        dialogTitle: opts.dialogTitle ?? 'Guardar o compartir',
      });

      return true;
    } catch (err) {
      console.error('[NativeIo] saveOrShareText failed:', err);
      return false;
    }
  }

  /**
   * Serialises a DOM subtree into a standalone, self-contained HTML document
   * and hands it to the share sheet.
   *
   * Why: `window.print()` is not implemented in either native WebView. Android's
   * WebView has no PrintManager wired to it (the JS call is a no-op), and
   * WKWebView likewise does not implement it — printing is Safari UI, not a
   * WebView capability. So a print button that works on the desktop site does
   * nothing at all on a phone, with no error.
   *
   * Sharing a real HTML file is the native equivalent: the share sheet offers
   * Print (both platforms ship a system print target), Save to Files/Drive, or
   * open-in-another-app.
   *
   * All CSS in the document is inlined so the file renders identically outside
   * the app. `@media print` rules are additionally re-applied for screen, since
   * the shared file is normally viewed on screen before being printed.
   */
  async sharePrintableNode(
    node: HTMLElement,
    filename: string,
    opts: { title?: string; dialogTitle?: string } = {}
  ): Promise<boolean> {
    const css = await this.collectDocumentCss();

    const html =
      '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      `<title>${(opts.title ?? filename).replace(/[<>&]/g, '')}</title>\n` +
      `<style>\n${css}\n</style>\n` +
      // The node is normally only visible inside an @media print block; force it
      // visible on screen too so the shared file is not a blank page.
      '<style>\n.print-sheet{display:block !important;}\nbody{margin:0;padding:16px;background:#fff;}\n</style>\n' +
      '</head>\n<body>\n' + node.outerHTML + '\n</body>\n</html>';

    return this.saveOrShareText(html, filename, opts);
  }

  /**
   * Gathers every same-origin stylesheet rule in the document. Angular injects
   * component styles as <style> elements, and the global bundle arrives as a
   * <link>. cssRules access is wrapped because a cross-origin sheet throws on
   * read — those are skipped rather than failing the whole export.
   */
  private async collectDocumentCss(): Promise<string> {
    const parts: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = (sheet as CSSStyleSheet).cssRules;
        if (!rules) continue;
        for (const rule of Array.from(rules)) parts.push(rule.cssText);
      } catch {
        // Cross-origin or otherwise unreadable sheet — skip it.
      }
    }
    return parts.join('\n');
  }

  /** Capacitor's Filesystem API takes base64 for binary data, not a Blob. */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const result = reader.result as string;
        // FileReader gives "data:<mime>;base64,XXXX" — Filesystem wants only XXXX.
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.readAsDataURL(blob);
    });
  }
}
