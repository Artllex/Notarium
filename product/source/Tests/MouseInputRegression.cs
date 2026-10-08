using System.Reflection;
using System.Text.Json;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Notatnik;

/// <summary>Tests the WPF input path, not just simulated Chromium clicks.</summary>
internal static class MouseInputRegression
{
    private static readonly FieldInfo ClickCount = typeof(MouseButtonEventArgs).GetField("_count", BindingFlags.Instance | BindingFlags.NonPublic)!;
    private static readonly FieldInfo MouseLocation = typeof(WebView2CompositionControl).GetField("_mouselocation", BindingFlags.Instance | BindingFlags.NonPublic)!;
    private static readonly MethodInfo SendMouse = typeof(WebView2CompositionControl).GetMethod("SendMouseInput", BindingFlags.Instance | BindingFlags.NonPublic)!;

    internal static async Task<int> RunAsync(WebEditorControl editor)
    {
        var web = (WebView2CompositionControl)typeof(WebEditorControl).GetField("_web", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(editor)!;
        var core = web.CoreWebView2;
        var passed = 0;
        async Task<JsonElement> Read(string script) => JsonDocument.Parse(await core.ExecuteScriptAsync(script)).RootElement.Clone();
        void Check(bool condition, string name)
        {
            if (!condition) throw new InvalidOperationException(name);
            Console.WriteLine("PASS " + name); passed++;
        }
        await core.ExecuteScriptAsync(@"
            window.mouseTrace = [];
            window.mouseErrors = [];
            addEventListener('error', e => mouseErrors.push(e.message));
            for (const type of ['mousedown','mouseup','dblclick'])
                document.addEventListener(type, e => mouseTrace.push({ type, detail: e.detail }), true);
            window.mouseSelected = () => {
                const ed = notatnik.editor, s = ed.state.selection;
                return ed.state.doc.textBetween(s.from, s.to, '|');
            };
        ");
        async Task Open(string content)
        {
            // A fresh gesture needs the native browser's multi-click interval to expire.
            await Task.Delay(650);
            await core.ExecuteScriptAsync(@"
                (() => {
                    const p = text => ({type:'paragraph',content:[{type:'text',text}]});
                    const item = (...content) => ({type:'listItem',content});
                    const doc = {type:'doc',content:" + content + @"};
                    notatnik.receive({type:'open',noteId:" + JsonSerializer.Serialize(Guid.NewGuid().ToString()) + @",documentJson:JSON.stringify({version:1,doc})});
                    mouseTrace = [];
                })()");
            await Task.Delay(100);
        }
        async Task<System.Drawing.Point> Point(string selector, int offset = 2)
        {
            var coords = await Read(@"(() => {
                const el = document.querySelector(" + JsonSerializer.Serialize(selector) + @");
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                let text, offset = " + offset + @";
                while (text = walker.nextNode()) {
                    if (offset < text.length) break;
                    offset -= text.length;
                }
                const range = document.createRange();
                range.setStart(text,offset); range.setEnd(text,offset+1);
                const r = range.getBoundingClientRect();
                return [(r.left+1)*devicePixelRatio,(r.top+r.bottom)/2*devicePixelRatio];
            })()");
            return new System.Drawing.Point((int)coords[0].GetDouble(), (int)coords[1].GetDouble());
        }
        void Routed(System.Drawing.Point point, int count, bool down)
        {
            MouseLocation.SetValue(web, point);
            var e = new MouseButtonEventArgs(Mouse.PrimaryDevice, Environment.TickCount, MouseButton.Left)
            {
                RoutedEvent = down ? Mouse.MouseDownEvent : Mouse.MouseUpEvent, Source = web
            };
            ClickCount.SetValue(e, count);
            web.RaiseEvent(e);
        }
        async Task Click(System.Drawing.Point point, int count)
        {
            Routed(point, count, true); await Task.Delay(30);
            Routed(point, count, false); await Task.Delay(50);
        }
        void Input(CoreWebView2MouseEventKind kind, CoreWebView2MouseEventVirtualKeys keys, System.Drawing.Point point) =>
            SendMouse.Invoke(web, new object[] { kind, keys, (uint)0, point });

        foreach (var list in new[] { "orderedList", "bulletList" })
        {
            await Open("[{type:'blockGroup',attrs:{textFlow:true},content:[p('Lista:'),{type:'" + list + "',content:[item(p('First')),item(p('Middle'),{type:'" + list + "',content:[item(p('Last item'))]})]}]},p('Outside')]");
            var point = await Point(".text-flow-content li li p");
            await Click(point, 1); await Click(point, 2);
            Check((await Read("mouseSelected()")).GetString() == "Last item", "native double click selects one nested " + list + " line");
            var trace = await Read("mouseTrace");
            Check(trace.EnumerateArray().Where(e => e.GetProperty("type").GetString() == "mousedown").Select(e => e.GetProperty("detail").GetInt32()).SequenceEqual(new[] { 1, 2 }), "WPF double click forwards exactly two presses: " + list);
            await Click(point, 3);
            Check((await Read("mouseSelected()")).GetString() == "Lista:|First|Middle|Last item", "native triple click selects only the owning " + list + " container");
            trace = await Read("mouseTrace");
            Check(trace.EnumerateArray().Where(e => e.GetProperty("type").GetString() == "mousedown").Select(e => e.GetProperty("detail").GetInt32()).SequenceEqual(new[] { 1, 2, 3 }), "WPF triple click forwards exactly three presses: " + list);
        }
        await Open("[{type:'paragraph',content:[{type:'text',text:'First line'},{type:'hardBreak'},{type:'text',text:'Second line'}]},p('Outside')]");
        var secondLine = await Read(@"(() => {const t=document.querySelector('.object-container p').lastChild,r=document.createRange();r.setStart(t,2);r.setEnd(t,3);const b=r.getBoundingClientRect();return [(b.left+1)*devicePixelRatio,(b.top+b.bottom)/2*devicePixelRatio]})()");
        var lastPoint = new System.Drawing.Point((int)secondLine[0].GetDouble(), (int)secondLine[1].GetDouble());
        await Click(lastPoint, 1); await Click(lastPoint, 2);
        Check((await Read("mouseSelected()")).GetString() == "Second line", "native double click selects one hard-break line, not both");
        await Click(lastPoint, 3);
        Check((await Read("mouseSelected()")).GetString() == "First lineSecond line", "native triple click selects both hard-break lines");

        await Open("[p('Alpha Beta Gamma'),p('Outside')]");
        foreach (var offset in new[] { 2, 13 })
        {
            var point = await Point(".object-container p", offset);
            Input(CoreWebView2MouseEventKind.LeftButtonDown, CoreWebView2MouseEventVirtualKeys.Control | CoreWebView2MouseEventVirtualKeys.LeftButton, point);
            await Task.Delay(30);
            Input(CoreWebView2MouseEventKind.LeftButtonUp, CoreWebView2MouseEventVirtualKeys.Control, point);
            await Task.Delay(650);
        }
        Check((await Read("[...document.querySelectorAll('.word-multi-selection')].map(e=>e.textContent).join('|')")).GetString() == "Alpha|Gamma", "native Ctrl clicks preserve two selected words");

        await Open("[p('Alpha Beta Gamma'),p('Outside')]");
        var dragFrom = await Point(".object-container p", 1);
        var dragTo = await Point(".object-container p", 13);
        var before = (await Read("JSON.stringify(notatnik.editor.getJSON())")).GetString();
        Routed(dragFrom, 1, true);
        await Task.Delay(50);
        Input(CoreWebView2MouseEventKind.Move, CoreWebView2MouseEventVirtualKeys.LeftButton, dragTo);
        await Task.Delay(100);
        Routed(dragTo, 1, false);
        await Task.Delay(100);
        Check((await Read("mouseSelected()")).GetString()!.Length > 0, "native mouse drag still selects text");
        Check((await Read("JSON.stringify(notatnik.editor.getJSON())")).GetString() == before, "native text selection drag does not move or change containers");
        Check((await Read("mouseErrors.length")).GetInt32() == 0, "native mouse regression has no JavaScript errors");
        return passed;
    }
}
