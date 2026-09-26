using System.IO;
using System.Windows;
using System.Windows.Controls;
using Notarium.UI;
using Notatnik;

internal static class Program
{
    private static int _passed;
    private static void Check(bool condition, string name) { if (!condition) throw new InvalidOperationException(name); Console.WriteLine("PASS " + name); _passed++; }
    [STAThread]
    private static void Main()
    {
        var app = new Application();
        app.Resources.MergedDictionaries.Add(new ResourceDictionary { Source = new Uri("pack://application:,,,/Notarium.UI;component/Theme.xaml") });
        var popup = new DropDownMenu(new ActionButton());
        var clicks = 0;
        var choice = new MenuItem { Header = "Borders", IsCheckable = true };
        choice.Click += (_, _) => clicks++;
        popup.Items.Add(choice);
        var menuView = (Border)popup.View;
        var rows = (StackPanel)((ScrollViewer)menuView.Child).Content;
        ((Button)rows.Children[0]).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(choice.IsChecked && clicks == 1, "shared menu toggles before dispatching one action");
        var visualHeader = new TextBlock { Text = "Segoe UI" };
        popup.Items.Add(new MenuItem { Header = visualHeader });
        _ = popup.View; _ = popup.View;
        Check(visualHeader.Parent is Grid, "shared menu rebuild preserves visual headers");
        var fixture = Path.Combine(Environment.GetEnvironmentVariable("NOTARIUM_TEST_ROOT") ?? Path.GetTempPath(), "Notarium-refactor-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(fixture);
        var library = new NotebookLibrary(new NoteStore(Path.Combine(fixture, "notes.json")));
        library.Load(); var first = library.Create(); library.Rename(first, "  Pierwsza  ");
        Check(first.Title == "Pierwsza", "library owns title normalization");
        library.BeginRename(first, true); Check(first.IsRenamingInSidebar, "library owns rename state");
        library.CancelRename(first); Check(!first.IsRenaming, "rename cancellation");
        Check(library.Update(first.Id, "text", null) && !library.Update(first.Id, "text", null), "document update idempotence");
        Check(!library.Update(Guid.NewGuid(), "other", null), "unknown note cannot change existing notes");
        library.ToggleFavorite(first); library.Save();
        var reopened = new NotebookLibrary(new NoteStore(Path.Combine(fixture, "notes.json"))); reopened.Load();
        Check(reopened.Notes.Count == 1 && reopened.Notes[0].IsFavorite && reopened.Notes[0].Content == "text", "storage compatibility after extraction");
        library.Remove(first); Check(library.Notes.Count == 1, "deleting last note retains established library behavior");
        var tabs = new NotebookTabs();
        for (var i = 0; i < 12; i++) tabs.Activate(new Note());
        tabs.Refresh(500); Check(tabs.Visible.Count < tabs.Open.Count && tabs.CanGoNext, "tabs paginate independently of window");
        tabs.Next(); tabs.Refresh(500); Check(tabs.CanGoBack, "next tab page");
        tabs.Refresh(500, tabs.Open[0]); Check(tabs.PageStart == 0, "activation scrolls back to first tab");
        var count = tabs.Open.Count; tabs.Activate(tabs.Open[0].Note); Check(tabs.Open.Count == count, "activation does not duplicate a tab");
        var window = new MainWindow(new NoteStore(Path.Combine(fixture, "window-notes.json")), false);
        Check(window.FindName("LibraryView") is NotebookLibraryPanel && window.FindName("TabsView") is NotebookTabsPanel, "notebook composes independent library and tab views");
        Check(window.FindName("MainMenu") is MenuBar, "menu bar uses shared menu component");
        Check(window.Notes.Count == 1 && window.OpenNotes.Count == 1, "notebook composition preserves startup state");
        NotebookRuntime.Configure(); NotebookRuntime.Configure();
        Check(File.Exists(Path.Combine(NotebookRuntime.LoaderFolder, "WebView2Loader.dll")), "native runtime resolves from module and supports repeated opening");
        (window.FindName("Editor") as WebEditorControl)?.Dispose();
        var nativeEditor = new WebEditorControl { DataDirectory = Path.Combine(fixture, "web-runtime") };
        string? nativeError = null;
        nativeEditor.EditorError += (_, message) => nativeError = message;
        var nativeHost = new Window { Content = nativeEditor, Width = 800, Height = 500, Opacity = 0, ShowInTaskbar = false };
        nativeHost.Show();
        var frame = new System.Windows.Threading.DispatcherFrame();
        var deadline = DateTime.UtcNow.AddSeconds(25);
        var poll = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
        poll.Tick += (_, _) => { if (nativeEditor.Ready.IsCompleted || nativeError is not null || DateTime.UtcNow >= deadline) frame.Continue = false; };
        poll.Start(); System.Windows.Threading.Dispatcher.PushFrame(frame); poll.Stop();
        Check(nativeEditor.Ready.IsCompletedSuccessfully && nativeError is null, "real WebView2 editor reaches ready in isolated module data: " + nativeError);
        nativeEditor.Dispose(); nativeHost.Close();
        Console.WriteLine($"TOTAL {_passed} checks passed; fixture: {fixture}");
        app.Shutdown();
    }
}
