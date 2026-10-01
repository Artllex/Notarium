using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Data;
using Microsoft.Win32;
using System.IO;
using Notarium.UI;

namespace Notatnik;

public partial class MainWindow : Window, INotifyPropertyChanged, Notarium.Contracts.INewItemWindow
{
    public void CreateNewItem() => NewNote_Click(this, new RoutedEventArgs());
    private readonly NotebookLibrary _library;
    private readonly RecentFilesStore _recentFiles;
    private readonly NotebookTabs _tabs = new();
    private readonly NotebookAutosave _saveTimer;
    private readonly NotebookFormatting _formatting;
    private bool _closingApproved;
    private bool _closingInProgress;
    private bool _loadFailed;
    private int _zoomPercent = 100;

    public ObservableCollection<Note> Notes => _library.Notes;
    public ObservableCollection<OpenNote> OpenNotes => _tabs.Open;
    public ObservableCollection<OpenNote> VisibleTabs => _tabs.Visible;

    public double TabWidth => _tabs.Width;

    public Note? ActiveNote
    {
        get => _library.ActiveNote;
        set
        {
            if (_library.ActiveNote == value) return;
            _library.ActiveNote = value;
            OnPropertyChanged();
        }
    }

    public MainWindow() : this(new NoteStore(), true) { }

    public MainWindow(NoteStore store, bool openExample = false, RecentFilesStore? recentFiles = null)
    {
        _library = new NotebookLibrary(store);
        _recentFiles = recentFiles ?? new RecentFilesStore();
        InitializeComponent();
        // Preserve notebook-specific views and behavior, share the application frame.
        var original = (Grid)((Border)Content).Child;
        var workspace = (Grid)((Grid)TabsView.Parent).Parent;
        original.Children.Remove(LibraryView); original.Children.Remove(MainMenu); original.Children.Remove(workspace);
        workspace.Children.Remove(NotebookStatusBar);
        workspace.RowDefinitions.RemoveAt(4);
        var frame = new ApplicationFrame(this);
        frame.RestoreSidebarFromWorkspace = true;
        frame.SidebarVisibilityChanged += show => { TabsView.SetSidebarCollapsed(!show); Dispatcher.BeginInvoke(new Action(() => RefreshVisibleTabs())); };
        TabsView.SidebarRestoreRequested += (_, _) => frame.ToggleSidebar();
        frame.Sidebar.Content = LibraryView; frame.Menu.Content = MainMenu; frame.Workspace.Content = workspace; frame.Status.Content = NotebookStatusBar;
        LibraryView.SidebarToggleRequested += (_, _) => frame.ToggleSidebar();
        Content = frame;
        _formatting = new NotebookFormatting(Editor, () => ActiveNote,
            label => FontFamilyButton.Content = label, label => LineSpacingButton.Content = label,
            (highlight, hex) => { var brush = UiPolicy.Brush(hex); if (highlight) HighlightColorSwatch.Background = brush; else FontColorSwatch.Background = brush; });
        InitializeViewRouting();
        DataContext = this;
        Editor.DocumentChanged += Editor_DocumentChanged;
        Editor.SelectionChanged += Editor_SelectionChanged;
        Editor.EditorError += (_, message) => DialogService.Show(this, message, "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
        Editor.ShortcutRequested += (_, key) =>
        {
            if (key == "n") NewNote_Click(this, new RoutedEventArgs());
            else if (key == "o") OpenFile_Click(this, new RoutedEventArgs());
            else if (key == "s") SaveFile_Click(this, new RoutedEventArgs());
        };

        _saveTimer = new NotebookAutosave(() => SaveNotes());

        try
        {
            _library.Load();
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
        {
            _loadFailed = true;
            DialogService.Show(null, $"Nie udało się odczytać notatek. Plik pozostaje niezmieniony.\n\n{error.Message}", "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
            throw new IOException("Nie można otworzyć danych Notatnika. Powłoka Notarium pozostaje dostępna.", error);
        }
        Note? example = null;
        if (openExample)
        {
            var exampleId = Guid.Parse("99a2f5dc-7f71-45ab-93b5-8b5992b5b268");
            example = Notes.FirstOrDefault(note => note.Id == exampleId);
            if (example is null)
            {
                using var stream = typeof(MainWindow).Assembly.GetManifestResourceStream("Notarium.Example.md")!;
                using var reader = new StreamReader(stream);
                example = new Note { Id = exampleId, CustomTitle = "Od światła do energii", Content = reader.ReadToEnd() };
                Notes.Insert(0, example);
                ScheduleSave();
            }
        }
        if (Notes.Count == 0) Notes.Add(new Note());

        OpenNote(example ?? Notes[0], false);
        Editor.Focus();
    }

    private async void Window_Closing(object? sender, CancelEventArgs e)
    {
        if (_closingApproved || _loadFailed) { Editor.Dispose(); return; }
        e.Cancel = true;
        if (_closingInProgress) return;
        _closingInProgress = true;
        try
        {
            await Editor.FlushAsync();
            _saveTimer.Stop();
            if (!SaveNotes()) return;
            _closingApproved = true;
            Close();
        }
        catch (Exception error)
        {
            DialogService.Show(this, "Nie udało się odebrać ostatnich zmian. Okno pozostaje otwarte.\n\n" + error.Message, "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally { _closingInProgress = false; }
    }
    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
