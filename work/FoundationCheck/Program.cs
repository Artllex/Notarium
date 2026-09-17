using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Notatnik;
using Notatnik.Core;

internal static class Program
{
    private static int _passed;
    [STAThread]
    private static int Main(string[] args)
    {
        _ = new Application();
        try
        {
            Check("Text round-trip including blank lines, spaces and emoji", () =>
            {
                foreach (var text in new[] { "", "a", "a\r\n", "a\r\n\r\n", "\r\na\r\n  ", "🦊 Firefox\r\nZażółć gęślą", "🦊 🐱 👨‍👩‍👧‍👦" })
                {
                    var editor = new MarkdownEditor { Text = text };
                    Equal(text, editor.Text);
                    editor.RefreshMarkdownFormatting();
                    Equal(text, editor.Text);
                }
            });
            Check("Cell storage preserves indentation, empty lines and backticks", () =>
            {
                foreach (var code in new[] { "", "\r\n", "    print('a')\r\n\r\n", "text = '''\r\n```\r\n'''" })
                {
                    var parts = new[] { new DocumentPart("before\r\n"), new DocumentPart(code, true), new DocumentPart("\r\nafter\r\n") };
                    var source = DocumentCodec.Encode(parts);
                    Equal(source, DocumentCodec.Encode(DocumentCodec.Decode(source)));
                    var editor = new MarkdownEditor { Text = source };
                    Equal(source, editor.Text);
                    Equal(code, Cells(editor).Single().Code);
                }
            });
            Check("Typing into empty document undo/redo reaches empty state", () =>
            {
                var editor = new MarkdownEditor();
                editor.SelectedText = "a";
                editor.CaretIndex = 1;
                editor.SelectedText = "b";
                editor.RefreshMarkdownFormatting();
                editor.UndoContentChange(); Equal("a", editor.Text);
                editor.UndoContentChange(); Equal("", editor.Text);
                editor.RedoContentChange(); Equal("a", editor.Text);
                editor.RedoContentChange(); Equal("ab", editor.Text);
            });
            Check("Only content edits raise persistence event", () =>
            {
                var editor = new MarkdownEditor { Text = "hello" };
                var count = 0;
                editor.ContentChanged += (_, _) => count++;
                editor.Select(0, 5);
                editor.Edit(() => { editor.SelectedText = "**hello**"; editor.Select(2, 5); });
                editor.RefreshMarkdownFormatting();
                Pump();
                Equal(1, count);
                editor.FontSize = 20; editor.RefreshMarkdownFormatting();
                Equal(1, count);
                editor.UndoContentChange(); Equal("hello", editor.Text);
                editor.RedoContentChange(); Equal("**hello**", editor.Text);
            });
            Check("Add, edit, delete cell uses same undo/redo history", () =>
            {
                var editor = new MarkdownEditor { Text = "note" };
                editor.AddPythonCell();
                var added = editor.Text;
                var box = Descendants<TextBox>(Cells(editor).Single()).Single();
                box.Text = "print(42)";
                var edited = editor.Text;
                Click(Cells(editor).Single(), "Usuń komórkę");
                Equal(0, Cells(editor).Count());
                editor.UndoContentChange(); Equal(edited, editor.Text);
                editor.UndoContentChange(); Equal(added, editor.Text);
                editor.UndoContentChange(); Equal("note", editor.Text);
                editor.RedoContentChange(); Equal(added, editor.Text);
                editor.RedoContentChange(); Equal(edited, editor.Text);
                editor.RedoContentChange(); Equal(0, Cells(editor).Count());
            });
            Check("Moving cell and routed menu Undo/Redo", () =>
            {
                var editor = new MarkdownEditor { Text = "note" };
                editor.AddPythonCell();
                var before = editor.Text;
                Click(Cells(editor).Single(), "Przenieś komórkę w górę");
                var after = editor.Text;
                True(before != after);
                ApplicationCommands.Undo.Execute(null, editor); Equal(before, editor.Text);
                ApplicationCommands.Redo.Execute(null, editor); Equal(after, editor.Text);
            });
            Check("History resets on switching notes and branches after undo", () =>
            {
                var editor = new MarkdownEditor { Text = "A" };
                editor.AddPythonCell();
                editor.Text = "B";
                editor.UndoContentChange(); Equal("B", editor.Text);
                editor.Select(1, 0); editor.SelectedText = "1";
                editor.UndoContentChange(); Equal("B", editor.Text);
                editor.Select(1, 0); editor.SelectedText = "2";
                editor.RedoContentChange(); Equal("B2", editor.Text);
            });
            Check("Undo command from code field reaches document history", () =>
            {
                var editor = new MarkdownEditor { Text = "text" };
                editor.AddPythonCell();
                var box = Descendants<TextBox>(Cells(editor).Single()).Single();
                box.Text = "code";
                ApplicationCommands.Undo.Execute(null, box);
                Equal("", Cells(editor).Single().Code);
                ApplicationCommands.Undo.Execute(null, editor);
                Equal("text", editor.Text);
            });
            Check("Numbered list Enter and indentation are one edit each", () =>
            {
                var editor = new MarkdownEditor { Text = "1. first" };
                editor.CaretIndex = editor.PlainText.Length;
                PressKey(editor, Key.Enter);
                Equal("1. first\r\n2. ", editor.Text);
                Equal(editor.PlainText.Length, editor.CaretIndex);
                editor.UndoContentChange(); Equal("1. first", editor.Text);
                editor.RedoContentChange(); Equal("1. first\r\n2. ", editor.Text);
                editor.CaretIndex = editor.PlainText.Length;
                PressKey(editor, Key.Tab);
                Equal("1. first\r\n    1. ", editor.Text);
                editor.UndoContentChange(); Equal("1. first\r\n2. ", editor.Text);
            });
            Check("Pointer mapping survives formatting and multiple paragraphs", () =>
            {
                var editor = new MarkdownEditor { Text = "abc\r\ndef" };
                for (var i = 0; i < editor.PlainText.Length; i++)
                {
                    if (editor.PlainText[i] is '\r' or '\n') continue;
                    editor.Select(i, 1); Equal(editor.PlainText[i].ToString(), editor.SelectedText);
                }
                editor.Text = "**bold** plain <span style=\"color:#58B889\">green</span>";
                editor.RefreshMarkdownFormatting();
                editor.Select(editor.PlainText.IndexOf("green", StringComparison.Ordinal), 5);
                Equal("green", editor.SelectedText);
                Equal("#FF58B889", ((SolidColorBrush)editor.Selection.GetPropertyValue(TextElement.ForegroundProperty)).Color.ToString());
                editor.Select(2, 4);
                Equal(FontWeights.Bold, editor.Selection.GetPropertyValue(TextElement.FontWeightProperty));
            });
            Check("History has a bounded number of entries", () =>
            {
                var history = new EditHistory(); history.Reset(new(""));
                for (var i = 0; i < 500; i++) history.Record(new(i.ToString()));
                var count = 0; while (history.Undo() is not null) count++;
                True(count <= 149);
            });
            Check("Formatting after a code cell uses visible-text offsets", () =>
            {
                var editor = new MarkdownEditor { Text = DocumentCodec.Encode(new[]
                {
                    new DocumentPart("before"), new DocumentPart("print(1)", true),
                    new DocumentPart("<span style=\"color:#58B889\">green</span>")
                }) };
                editor.Select(editor.PlainText.IndexOf("green", StringComparison.Ordinal), 5);
                Equal("green", editor.SelectedText);
                Equal("#FF58B889", ((SolidColorBrush)editor.Selection.GetPropertyValue(TextElement.ForegroundProperty)).Color.ToString());
            });
            Check("Sidebar title and preview never expose Markdown or HTML syntax", () =>
            {
                var note = new Note
                {
                    Content = "<!-- notarium:article width=790 -->\r\n\r\n# Od światła do energii\r\n\r\n**Artykuł demonstracyjny** z <span style=\"color:#58B889\">czystym opisem</span>."
                };
                Equal("Od światła do energii", note.Title);
                Equal("Artykuł demonstracyjny z czystym opisem.", note.Preview);
                True(!note.Title.Contains('#') && !note.Preview.Contains('<') && !note.Preview.Contains("span"));

                note.Content = "# Obraz\r\n\r\n![Schemat](data:image/png;base64,AAAA)";
                Equal("Obraz", note.Title);
                Equal("Schemat", note.Preview);
            });
            Check("Disk save preserves metadata, makes backup, rejects corrupt input", () =>
            {
                var directory = Path.Combine(Path.GetTempPath(), "Notatnik-check-" + Guid.NewGuid());
                Directory.CreateDirectory(directory);
                var path = Path.Combine(directory, "notes.json");
                var store = new NoteStore(path);
                var note = new Note { Content = "first", UpdatedAtUtc = new DateTime(2024, 1, 2, 3, 4, 5, DateTimeKind.Utc), IsFavorite = true, CustomTitle = "title" };
                store.Save(new[] { note });
                Equal(note.UpdatedAtUtc, store.Load().Single().UpdatedAtUtc);
                note.Content = "second"; store.Save(new[] { note });
                Equal("second", store.Load().Single().Content);
                Equal("first", new NoteStore(path + ".bak").Load().Single().Content);
                File.WriteAllText(path, "{broken");
                try { store.Load(); throw new Exception("Corrupt input was accepted"); }
                catch (JsonException) { }
                Equal("{broken", File.ReadAllText(path));
                foreach (var file in Directory.GetFiles(directory)) File.Delete(file);
                Directory.Delete(directory);
            });
            Benchmark();
            if (args.Contains("--render")) Render();
            Console.WriteLine($"PASS: {_passed} regression scenarios");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }

    private static void Benchmark()
    {
        Console.WriteLine("MEASURE: loading 12k text");
        var editor = new MarkdownEditor { Text = new string('x', 12000) };
        Console.WriteLine("MEASURE: loaded, selecting");
        var timer = Stopwatch.StartNew();
        for (var i = 0; i < 30; i++) editor.Select(11000, 20);
        timer.Stop();
        Console.WriteLine($"MEASURE: 30 selections in 12k text = {timer.Elapsed.TotalMilliseconds:F1} ms");
        var plain = string.Join("\r\n", Enumerable.Repeat("**bold** text <span style=\"color:#58B889\">green</span>", 40));
        editor.Text = plain;
        timer.Restart(); editor.RefreshMarkdownFormatting(); timer.Stop();
        Console.WriteLine($"MEASURE: formatting 40 styled lines = {timer.Elapsed.TotalMilliseconds:F1} ms");
    }

    private static IEnumerable<CodeCellControl> Cells(MarkdownEditor editor) => editor.Document.Blocks.OfType<BlockUIContainer>().Select(b => b.Child).OfType<CodeCellControl>();
    private static void Render()
    {
        var appXaml = System.Xml.Linq.XDocument.Load("work/Notatnik/App.xaml");
        var resourceMarkup = string.Concat(appXaml.Root!.Elements().First().Elements().Select(element => element.ToString()));
        Application.Current.Resources = (ResourceDictionary)System.Windows.Markup.XamlReader.Parse(
            "<ResourceDictionary xmlns=\"http://schemas.microsoft.com/winfx/2006/xaml/presentation\" xmlns:x=\"http://schemas.microsoft.com/winfx/2006/xaml\">" + resourceMarkup + "</ResourceDictionary>");
        var editor = new MarkdownEditor
        {
            Background = new SolidColorBrush(Color.FromRgb(30, 30, 30)), Foreground = Brushes.White,
            FontFamily = new FontFamily("Segoe UI"), FontSize = 16, BorderThickness = new Thickness(0), Padding = new Thickness(20),
            Text = "🦊 Notatka testowa\r\n**Pogrubienie** i zwykły tekst."
        };
        editor.AddPythonCell();
        Descendants<TextBox>(Cells(editor).Single()).Single().Text = "def greeting(name):\r\n    return f'Hello, {name}!'\r\n\r\nprint(greeting('Arkad'))";
        editor.RefreshMarkdownFormatting();
        editor.Measure(new Size(1000, 360));
        editor.Arrange(new Rect(0, 0, 1000, 360));
        editor.UpdateLayout();
        var bitmap = new RenderTargetBitmap(1000, 360, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(editor);
        var path = Path.GetFullPath("outputs/foundation-check/cell.png");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var stream = File.Create(path); encoder.Save(stream);
        Console.WriteLine("RENDER: " + path);
    }
    private static IEnumerable<T> Descendants<T>(DependencyObject root) where T : DependencyObject
    {
        for (var i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child is T match) yield return match;
            foreach (var nested in Descendants<T>(child)) yield return nested;
        }
    }
    private static void Click(CodeCellControl cell, string tooltip) => Descendants<Button>(cell).Single(b => Equals(b.ToolTip, tooltip)).RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
    private static void Pump() => Application.Current.Dispatcher.Invoke(() => { }, DispatcherPriority.ApplicationIdle);
    private static void PressKey(MarkdownEditor editor, Key key)
    {
        var args = new KeyEventArgs(Keyboard.PrimaryDevice, new TestSource(), Environment.TickCount, key) { RoutedEvent = Keyboard.PreviewKeyDownEvent };
        editor.RaiseEvent(args);
    }
    private sealed class TestSource : PresentationSource
    {
        public override Visual RootVisual { get; set; } = null!;
        public override bool IsDisposed => false;
        protected override CompositionTarget GetCompositionTargetCore() => null!;
    }
    private static void Check(string name, Action action) { action(); Pump(); _passed++; Console.WriteLine("PASS: " + name); }
    private static void True(bool value) { if (!value) throw new Exception("Assertion failed"); }
    private static void Equal<T>(T expected, T actual) { if (!Equals(expected, actual)) throw new Exception($"Expected [{expected}], got [{actual}]"); }
}
