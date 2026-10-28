// Native macOS decoder/seek smoke test. Usage: swift ... cache-directory
import AppKit
import WebKit

let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).filter { $0.pathExtension == "mp4" }
guard !files.isEmpty else { fatalError("No prepared MP4 fixtures") }
let urls = String(data: try JSONSerialization.data(withJSONObject: files.map { $0.absoluteString }), encoding: .utf8)!
let html = """
<html><body><video id="v" muted playsinline></video><script>
const files = \(urls); const v = document.getElementById('v'); let i = 0;
const post = value => window.webkit.messageHandlers.result.postMessage(value);
v.onerror = () => post('FAIL: ' + v.error.code + ' ' + v.currentSrc);
v.onloadedmetadata = () => {
  if (!Number.isFinite(v.duration) || Math.abs(v.duration - 4) > .25) return post('FAIL: duration ' + v.duration);
  v.currentTime = 2.25;
};
v.onseeked = () => { if (Math.abs(v.currentTime - 2.25) > .15) post('FAIL: seek'); else v.play().catch(e => post('FAIL: ' + e)); };
v.ontimeupdate = () => {
  if (v.currentTime > 2.4) {
    v.pause(); post('PASS: native decode, resume/seek and playback ' + files[i]);
    if (++i === files.length) { v.ontimeupdate = null; post('DONE'); } else { v.src = files[i]; }
  }
};
v.src = files[0];
</script></body></html>
"""
let htmlURL = directory.appendingPathComponent("webkit-test.html")
try html.write(to: htmlURL, atomically: true, encoding: .utf8)
class Handler: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let result = String(describing: message.body)
        print(result)
        if result.hasPrefix("FAIL") { exit(1) }
        if result == "DONE" { exit(0) }
    }
}
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let config = WKWebViewConfiguration()
config.mediaTypesRequiringUserActionForPlayback = []
let handler = Handler()
config.userContentController.add(handler, name: "result")
let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 480, height: 300), configuration: config)
let window = NSWindow(contentRect: view.frame, styleMask: [.titled], backing: .buffered, defer: false)
window.contentView = view
view.loadFileURL(htmlURL, allowingReadAccessTo: directory)
DispatchQueue.main.asyncAfter(deadline: .now() + 30) { print("FAIL: WebKit timeout"); exit(1) }
app.run()
