using System.IO;
using System.Reflection;
using System.Runtime.Versioning;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Notatnik;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        var app = new Application(); var exitCode = 1;
        app.Startup += async (_, _) =>
        {
            var directory = Path.Combine(Path.GetTempPath(), "Notatnik-web-check-" + Guid.NewGuid());
            var editor = new WebEditorControl { DataDirectory = directory };
            var window = new Window { Content = editor, Width = 1000, Height = 600, Left = -12000, Top = -12000, ShowActivated = false, ShowInTaskbar = false };
            try
            {
                var errors = new List<string>(); editor.EditorError += (_, error) => errors.Add(error);
                DocumentChangedEventArgs? latest = null;
                var changes = 0;
                editor.DocumentChanged += (_, snapshot) => { latest = snapshot; changes++; };
                var firstId = Guid.NewGuid();
                editor.OpenNote(firstId, "# Notatka 🦊\n\nTekst przed komórką.", null);
                window.Show();
                await editor.Ready.WaitAsync(TimeSpan.FromSeconds(30));
                await editor.FlushAsync();
                Require(changes == 0, "Opening/flush must not migrate unchanged legacy notes");
                Console.WriteLine("PASS native host initializes embedded assets offline; opening preserves original data");
                editor.AddPythonCell(); await editor.FlushAsync();
                Require(latest?.NoteId == firstId && latest.DocumentJson.Contains("codeCell"), "Cell was not received by native host");
                editor.UndoContentChange(); await editor.FlushAsync();
                Require(!latest!.DocumentJson.Contains("codeCell"), "Native Undo did not remove cell");
                editor.RedoContentChange(); await editor.FlushAsync();
                Require(latest!.DocumentJson.Contains("codeCell"), "Native Redo did not restore cell");
                Console.WriteLine("PASS native toolbar → JavaScript → document → undo/redo → native persistence");
                var web = (WebView2CompositionControl)typeof(WebEditorControl).GetField("_web", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(editor)!;
                await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.code-cell').codeMirror.dispatch({changes:{from:0,insert:'print(42)'}})");
                await editor.FlushAsync();
                Require(latest!.DocumentJson.Contains("print(42)"), "CodeMirror edit was not persisted");
                var saved = latest;
                var note = new Note { Id = firstId, Content = saved.Markdown, DocumentJson = saved.DocumentJson };
                var store = new NoteStore(Path.Combine(directory, "test-notes.json")); store.Save(new[] { note });
                var reloaded = store.Load().Single();
                Require(reloaded.DocumentJson == saved.DocumentJson && reloaded.Content == saved.Markdown, "Disk round trip failed");
                Require(!reloaded.Preview.Contains("span"), "Preview leaked markup");
                editor.OpenNote(Guid.NewGuid(), "", reloaded.DocumentJson); await editor.FlushAsync();
                var code = await web.CoreWebView2.ExecuteScriptAsync("document.querySelector('.code-cell').codeMirror.state.doc.toString()");
                Require(JsonSerializer.Deserialize<string>(code) == "print(42)", "Structured reopen lost code");
                Console.WriteLine("PASS CodeMirror → native model → disk → reopened structured document");
                editor.SetZoom(150); editor.LineSpacingFactor = 1.5; await editor.FlushAsync();
                var size = await web.CoreWebView2.ExecuteScriptAsync("getComputedStyle(document.querySelector('.tiptap')).fontSize");
                Require(size == "\"24px\"", "Native zoom was not applied");
                var image = Path.GetFullPath("outputs/engines-check/native-webview.png"); Directory.CreateDirectory(Path.GetDirectoryName(image)!);
                using (var stream = File.Create(image)) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream);
                Require(errors.Count == 0, string.Join("\n", errors));
                Console.WriteLine("PASS native zoom and screenshot: " + image);
                await web.CoreWebView2.ExecuteScriptAsync("window.notatnik.editor.commands.insertBlockMath({latex:'E=mc^2'}); const canvas=document.createElement('canvas'); canvas.width=400; canvas.height=200; const ctx=canvas.getContext('2d'); ctx.fillStyle='#60a5fa'; ctx.fillRect(0,0,400,200); window.notatnik.editor.commands.setImage({src:canvas.toDataURL(),width:200});");
                await editor.FlushAsync();
                Require(latest!.DocumentJson.Contains("blockMath") && latest.DocumentJson.Contains("data:image/png"), "Native math/image snapshot lost content");
                var mathRendered = await web.CoreWebView2.ExecuteScriptAsync("!!document.querySelector('.katex') && document.querySelector('.tiptap img').width === 200");
                Require(mathRendered == "true", "Native math/image rendering failed");
                using (var stream = File.Create("outputs/engines-check/native-media.png")) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream);
                Console.WriteLine("PASS native KaTeX and 200px image render and persist through bridge");
                var titleEditor = new Emoji.Wpf.TextBox { Text = "🦊 Firefox", Foreground = Brushes.White, FontSize = 18, Background = Brushes.Transparent, BorderThickness = new Thickness(0), Padding = new Thickness(3, 0, 0, 0) };
                InlineTitleEditor.SetDark(titleEditor, true);
                var titleWindow = new Window { Content = titleEditor, Background = new SolidColorBrush(Color.FromRgb(59, 59, 59)), Width = 260, Height = 90, Left = -12000, Top = -12000, ShowActivated = false, ShowInTaskbar = false };
                titleWindow.Show();
                Require(Descendants<Emoji.Wpf.RichTextBox>(titleEditor).Single().Background == Brushes.Transparent,
                    "Title background must be transparent before deferred focus/selection runs");
                typeof(MainWindow).GetMethod("FocusAndSelectInlineTitle", BindingFlags.Static | BindingFlags.NonPublic)!.Invoke(null, new object[] { titleEditor });
                var innerTitleEditor = Descendants<Emoji.Wpf.RichTextBox>(titleEditor).Single();
                Require(innerTitleEditor.Background == Brushes.Transparent && innerTitleEditor.BorderThickness == new Thickness(0), "Inline title editor used a light background");
                Require(innerTitleEditor.Selection.Text == "🦊 Firefox", "Inline title was not fully selected");
                innerTitleEditor.IsInactiveSelectionHighlightEnabled = true;
                titleEditor.UpdateLayout();
                await app.Dispatcher.InvokeAsync(() => { }, System.Windows.Threading.DispatcherPriority.ApplicationIdle);
                var bitmap = new System.Windows.Media.Imaging.RenderTargetBitmap(260, 60, 96, 96, PixelFormats.Pbgra32);
                bitmap.Render(titleEditor);
                var pixels = new byte[260 * 60 * 4]; bitmap.CopyPixels(pixels, 260 * 4, 0);
                var visibleLetters = 0;
                for (var i = 0; i < pixels.Length; i += 4)
                    if (pixels[i] > 120 && pixels[i + 1] > 120 && pixels[i + 2] > 120 && pixels[i + 3] > 180) visibleLetters++;
                Require(visibleLetters > 40, "Selected title text is obscured in the rendered image");
                var encoder = new System.Windows.Media.Imaging.PngBitmapEncoder();
                encoder.Frames.Add(System.Windows.Media.Imaging.BitmapFrame.Create(bitmap));
                using (var stream = File.Create("outputs/engines-check/title-selection.png")) encoder.Save(stream);
                titleWindow.Close();
                Console.WriteLine("PASS inline emoji title editor keeps dark styling and selects the full title");
                var appXaml = System.Xml.Linq.XDocument.Load("work/Notatnik/App.xaml");
                var resourceMarkup = string.Concat(appXaml.Root!.Elements().First().Elements().Select(element => element.ToString()));
                app.Resources = (ResourceDictionary)System.Windows.Markup.XamlReader.Parse(
                    "<ResourceDictionary xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\" xmlns:x=\"http://schemas.microsoft.com/winfx/2006/xaml\">" + resourceMarkup + "</ResourceDictionary>");
                var shell = new MainWindow(store) { WindowState = WindowState.Normal, Left = -12000, Top = -12000, Width = 1400, Height = 800, ShowActivated = false, ShowInTaskbar = false };
                var shellEditor = (WebEditorControl)shell.FindName("Editor"); shellEditor.DataDirectory = Path.Combine(directory, "shell");
                shell.Show(); await shellEditor.Ready.WaitAsync(TimeSpan.FromSeconds(30)); await shellEditor.FlushAsync();
                var originalNote = shell.ActiveNote!;
                Descendants<Button>(shell).First(b => Equals(b.ToolTip, "Utwórz nową notatkę")).RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
                var newNote = shell.ActiveNote!; Require(newNote.Id != originalNote.Id, "New note button did not create a note");
                shellEditor.AddPythonCell(); await shellEditor.FlushAsync();
                Require(newNote.DocumentJson?.Contains("codeCell") == true, "Main window did not receive editor content");
                ((ListBox)shell.FindName("NotesList")).SelectedItem = originalNote;
                await shellEditor.FlushAsync(); Require(shell.ActiveNote == originalNote, "Sidebar selection did not switch the editor");
                ((ListBox)shell.FindName("NotesList")).SelectedItem = newNote;
                shellEditor.UndoContentChange(); await shellEditor.FlushAsync();
                Require(newNote.DocumentJson?.Contains("codeCell") == false, "Tab switch lost undo history");
                var closed = new TaskCompletionSource<bool>(); shell.Closed += (_, _) => closed.TrySetResult(true);
                shell.Close(); await closed.Task.WaitAsync(TimeSpan.FromSeconds(10));
                Require(store.Load().Count == 2, "Window close did not flush and save notes");
                Console.WriteLine("PASS full Windows shell: new note, sidebar switch, per-note history, flush and save on close");
                Console.WriteLine("PASS 7 native integration scenarios"); exitCode = 0;
            }
            catch (Exception error) { Console.Error.WriteLine(error); }
            finally { editor.Dispose(); window.Close(); app.Shutdown(); }
        };
        app.Run(); return exitCode;
    }
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    private static IEnumerable<T> Descendants<T>(DependencyObject root) where T : DependencyObject
    {
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child is T item) yield return item;
            foreach (var nested in Descendants<T>(child)) yield return nested;
        }
    }
}
