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
        Console.WriteLine("Test fixture: " + fixture);
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
        first.LastOpenedAtUtc = DateTime.UtcNow;
        library.Save();
        reopened.Load();
        Check(reopened.Notes[0].LastOpenedAtUtc == first.LastOpenedAtUtc, "recent note activity persists without changing its content");
        var recentFiles = new RecentFilesStore(Path.Combine(fixture, "recent-files.json"));
        var sampleFile = Path.Combine(fixture, "sample.md");
        File.WriteAllText(sampleFile, "external note");
        recentFiles.Record(sampleFile, first.Id);
        recentFiles.Record(sampleFile, first.Id);
        Check(recentFiles.Load().Count == 1 && recentFiles.Load()[0].NoteId == first.Id, "recent file history deduplicates paths and persists note links");
        library.Remove(first); Check(library.Notes.Count == 1, "deleting last note retains established library behavior");
        var pinStore = new NoteStore(Path.Combine(fixture, "pinned-tabs.json"));
        var pinned = new Note { Content = "Pinned", IsTabPinned = true };
        pinStore.Save(new[] { pinned, new Note { Content = "Unpinned" } });
        var pinWindow = new MainWindow(pinStore, false, new RecentFilesStore(Path.Combine(fixture, "pin-recent.json")));
        Check(pinWindow.OpenNotes.Count == 1 && pinWindow.OpenNotes[0].Note.Id == pinned.Id, "restart opens only pinned notes");        var route = typeof(MainWindow).GetMethod("RouteViewAction", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!;
        var pinAction = new ActionButton { Tag = pinWindow.OpenNotes[0] };
        route.Invoke(pinWindow, new object[] { "ToggleTabPin_Click", pinAction, new RoutedEventArgs(Button.ClickEvent) });
        Check(!pinWindow.OpenNotes[0].Note.IsTabPinned, "tab action routes unpin to notebook state");
        route.Invoke(pinWindow, new object[] { "ToggleTabPin_Click", pinAction, new RoutedEventArgs(Button.ClickEvent) });
        Check(pinWindow.OpenNotes[0].Note.IsTabPinned, "tab action routes pin to notebook state");
        var pinNotes = pinStore.Load();
        pinNotes.Single(note => note.Id == pinned.Id).IsTabPinned = false;
        pinStore.Save(pinNotes);
        var unpinWindow = new MainWindow(pinStore, false, new RecentFilesStore(Path.Combine(fixture, "unpin-recent.json")));
        Check(unpinWindow.OpenNotes.Count == 0, "unpin persists and restart opens no tabs");
        var tabs = new NotebookTabs();
        for (var i = 0; i < 12; i++) tabs.Activate(new Note());
        tabs.Refresh(500); Check(tabs.Visible.Count < tabs.Open.Count && tabs.CanGoNext, "tabs paginate independently of window");
        tabs.Next(); tabs.Refresh(500); Check(tabs.CanGoBack, "next tab page");
        tabs.Refresh(500, tabs.Open[0]); Check(tabs.PageStart == 0, "activation scrolls back to first tab");
        var count = tabs.Open.Count; tabs.Activate(tabs.Open[0].Note); Check(tabs.Open.Count == count, "activation does not duplicate a tab");
        var window = new MainWindow(new NoteStore(Path.Combine(fixture, "window-notes.json")), false,
            new RecentFilesStore(Path.Combine(fixture, "window-recent-files.json")));
        Check(window.FindName("LibraryView") is NotebookLibraryPanel && window.FindName("TabsView") is NotebookTabsPanel, "notebook composes independent library and tab views");
        Check(window.FindName("MainMenu") is MenuBar, "menu bar uses shared menu component");
        var notebookFrame = window.Content as ApplicationFrame;
        var ribbonMenu = notebookFrame?.Menu.Content as NotebookRibbon;
        foreach (var menu in RibbonVisualRegression.Descendants<MenuBar>(ribbonMenu!)) menu.RaiseEvent(new RoutedEventArgs(FrameworkElement.LoadedEvent));
        Check(ribbonMenu is not null && RibbonVisualRegression.Descendants<MenuBar>(ribbonMenu).Contains((MenuBar)window.FindName("MainMenu")),
            "native ribbon owns the shared File Edit menu without a separate row");
        notebookFrame!.Measure(new Size(1180, 760)); notebookFrame.Arrange(new Rect(0, 0, 1180, 760)); notebookFrame.UpdateLayout();
        var menuTop = ((FrameworkElement)window.FindName("MainMenu")).TranslatePoint(new Point(0, 0), notebookFrame).Y;
        var tabTop = RibbonVisualRegression.Button(ribbonMenu!, "Układ").TranslatePoint(new Point(0, 0), notebookFrame).Y;
        Check(Math.Abs(menuTop - tabTop) < 1, "File Edit menu and ribbon tabs occupy exactly the same row");
        var fileMenu = (MenuBar)window.FindName("MainMenu");
        Check(fileMenu.ActualWidth > 100 && RibbonVisualRegression.Button(ribbonMenu!, "Układ").TranslatePoint(new Point(), ribbonMenu).X >= fileMenu.TranslatePoint(new Point(fileMenu.ActualWidth, 0), ribbonMenu).X,
            "ribbon tabs follow the visible File Edit menu without overlapping it");
        var lastTab = RibbonVisualRegression.Button(ribbonMenu!, "Obiekty");
        var helpButton = RibbonVisualRegression.Button(ribbonMenu!, "Help");
        Check(helpButton.TranslatePoint(new Point(), ribbonMenu).X >= lastTab.TranslatePoint(new Point(lastTab.ActualWidth, 0), ribbonMenu).X,
            "Help follows all ribbon tabs");
        var referenceLabel = RibbonVisualRegression.Descendants<AccessText>(RibbonVisualRegression.Button(ribbonMenu!, "File")).Single();
        Check(new[] { "Układ", "Wstawianie", "Odwołania", "Obiekty", "Help" }.All(name => {
            var text = RibbonVisualRegression.Descendants<AccessText>(RibbonVisualRegression.Button(ribbonMenu!, name)).Single();
            return Math.Abs(text.TranslatePoint(new Point(), ribbonMenu).Y - referenceLabel.TranslatePoint(new Point(), ribbonMenu).Y) < 0.1;
        }), "menu and ribbon captions share the same vertical text position");
        var ribbonBitmap = new System.Windows.Media.Imaging.RenderTargetBitmap(1180, 760, 96, 96, System.Windows.Media.PixelFormats.Pbgra32);
        ribbonBitmap.Render(notebookFrame);
        var encoder = new System.Windows.Media.Imaging.PngBitmapEncoder(); encoder.Frames.Add(System.Windows.Media.Imaging.BitmapFrame.Create(ribbonBitmap));
        using (var image = File.Create(Path.Combine(fixture, "ribbon.png"))) encoder.Save(image);
        _passed += RibbonVisualRegression.Run(ribbonMenu!, fixture);
        var viewDefinition = (MenuItem)window.FindName("ViewMenuItem");
        var pagination = viewDefinition.Items.OfType<MenuItem>().Single(i => i.Header?.ToString() == "Paginacja");
        Check(pagination.Items.OfType<MenuItem>().Take(2).Select(i => i.Header?.ToString()).SequenceEqual(new[] { "Strony w dół", "Strony w bok" }) &&
              window.FindName("PageCountInput") is TextBox, "View exposes pagination direction and custom pages per row");
        Check(notebookFrame?.Status.Content == window.FindName("NotebookStatusBar") &&
              notebookFrame.Workspace.Content is Grid notebookWorkspace && notebookWorkspace.RowDefinitions.Count == 4,
            "notebook status content uses the shared frame without a duplicate workspace row");
        Check(window.Notes.Count == 1 && window.OpenNotes.Count == 0, "notebook starts without unpinned tabs");
        Check(window.OpenRecentFile(sampleFile) && window.OpenRecentFile(sampleFile) && window.Notes.Count == 2 &&
              window.ActiveNote?.Content == "external note", "reopening a recent file selects its existing note instead of importing a duplicate");
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
        var mouseTests = nativeHost.Dispatcher.InvokeAsync(() => MouseInputRegression.RunAsync(nativeEditor)).Task.Unwrap();
        frame = new System.Windows.Threading.DispatcherFrame();
        deadline = DateTime.UtcNow.AddSeconds(45);
        poll = new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
        poll.Tick += (_, _) => { if (mouseTests.IsCompleted || DateTime.UtcNow >= deadline) frame.Continue = false; };
        poll.Start(); System.Windows.Threading.Dispatcher.PushFrame(frame); poll.Stop();
        Check(mouseTests.IsCompleted, "native mouse regression finishes within its deadline");
        _passed += mouseTests.GetAwaiter().GetResult();
        nativeEditor.Dispose(); nativeHost.Close();
        Console.WriteLine($"TOTAL {_passed} checks passed; fixture: {fixture}");
        app.Shutdown();
    }
}
