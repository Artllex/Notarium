using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Data;
using Microsoft.Win32;
using System.IO;

namespace Notatnik;

public partial class MainWindow : Window, INotifyPropertyChanged
{
    private readonly NoteStore _store;
    private readonly DispatcherTimer _saveTimer;
    private Note? _activeNote;
    private bool _closingApproved;
    private bool _closingInProgress;
    private bool _loadFailed;
    private int _tabPageStart;
    private int _tabPageSize = 1;
    private double _tabWidth = 180;
    private int _zoomPercent = 100;

    public ObservableCollection<Note> Notes { get; } = new();
    public ObservableCollection<OpenNote> OpenNotes { get; } = new();
    public ObservableCollection<OpenNote> VisibleTabs { get; } = new();

    public double TabWidth
    {
        get => _tabWidth;
        private set { if (Math.Abs(_tabWidth - value) < 0.5) return; _tabWidth = value; OnPropertyChanged(); }
    }

    public Note? ActiveNote
    {
        get => _activeNote;
        set
        {
            if (_activeNote == value) return;
            _activeNote = value;
            OnPropertyChanged();
        }
    }

    public MainWindow() : this(new NoteStore(), true) { }

    public MainWindow(NoteStore store, bool openExample = false)
    {
        _store = store;
        InitializeComponent();
        DataContext = this;
        Editor.DocumentChanged += Editor_DocumentChanged;
        Editor.SelectionChanged += Editor_SelectionChanged;
        Editor.EditorError += (_, message) => MessageBox.Show(this, message, "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
        Editor.ShortcutRequested += (_, key) =>
        {
            if (key == "n") NewNote_Click(this, new RoutedEventArgs());
            else if (key == "o") OpenFile_Click(this, new RoutedEventArgs());
            else if (key == "s") SaveFile_Click(this, new RoutedEventArgs());
        };

        _saveTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(550) };
        _saveTimer.Tick += (_, _) => { _saveTimer.Stop(); SaveNotes(); };

        try
        {
            foreach (var note in _store.Load().OrderByDescending(note => note.UpdatedAtUtc)) Notes.Add(note);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
        {
            _loadFailed = true;
            MessageBox.Show($"Nie udało się odczytać notatek. Plik pozostaje niezmieniony.\n\n{error.Message}", "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
            Application.Current.Shutdown();
            return;
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

        OpenNote(example ?? Notes[0]);
        Editor.Focus();
    }

    private void NewNote_Click(object sender, RoutedEventArgs e)
    {
        var note = new Note();
        Notes.Insert(0, note);
        OpenNote(note);
        Editor.Focus();
        ScheduleSave();
    }

    private void ZoomOut_Click(object sender, RoutedEventArgs e) => ChangeZoom(-10);

    private void ZoomIn_Click(object sender, RoutedEventArgs e) => ChangeZoom(10);

    private void ZoomMenu_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button source) return;
        var menu = CreatePopupMenu(source, itemWidth: 58);
        for (var percent = 100; percent <= 200; percent += 10)
        {
            var value = percent;
            var item = new MenuItem
            {
                Header = $"{value}%",
                IsCheckable = true,
                IsChecked = value == _zoomPercent,
                Style = PopupMenuItemStyle()
            };
            item.Click += (_, _) => SetZoom(value);
            menu.Items.Add(item);
        }
        menu.IsOpen = true;
    }

    private void ChangeZoom(int change)
    {
        SetZoom(Math.Clamp(_zoomPercent + change, 20, 200));
    }

    private void SetZoom(int percent)
    {
        _zoomPercent = Math.Clamp(percent, 20, 200);
        Editor.SetZoom(_zoomPercent);
        ZoomButton.Content = $"{_zoomPercent}%";
        Editor.Focus();
    }

    private void OpenNote(Note note)
    {
        if (ActiveNote == note) { Editor.Focus(); return; }
        var tab = OpenNotes.FirstOrDefault(open => open.Note == note);
        if (tab is null)
        {
            tab = new OpenNote(note);
            OpenNotes.Add(tab);
        }

        foreach (var open in OpenNotes) open.IsActive = open == tab;
        RefreshVisibleTabs(tab);
        ActiveNote = note;
        NotesList.SelectedItem = note;

        Editor.OpenNote(note.Id, note.Content, note.DocumentJson);
        Editor.Focus();
    }

    private void NotesList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (NotesList.SelectedItem is Note note && note != ActiveNote) OpenNote(note);
    }

    private void SidebarTitle_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount != 2 || sender is not FrameworkElement { DataContext: Note note } title) return;
        var container = NotesList.ItemContainerGenerator.ContainerFromItem(note) as DependencyObject;
        BeginInlineRename(note, container ?? title, inSidebar: true);
        e.Handled = true;
    }

    private void TabTitle_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount != 2 || sender is not FrameworkElement { DataContext: OpenNote tab } title) return;
        BeginInlineRename(tab.Note, FindAncestor<ContentPresenter>(title) ?? title, inSidebar: false);
        e.Handled = true;
    }

    private void Tab_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.OriginalSource is DependencyObject source && FindAncestor<Button>(source) is not null) return;
        if (sender is not FrameworkElement { DataContext: OpenNote tab }) return;
        if (e.ClickCount == 2)
        {
            BeginInlineRename(tab.Note, (DependencyObject)sender, inSidebar: false);
            e.Handled = true;
        }
        else OpenNote(tab.Note);
    }

    private void CloseTab_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is not Button { Tag: OpenNote tab }) return;
        var index = OpenNotes.IndexOf(tab);
        OpenNotes.Remove(tab);
        RefreshVisibleTabs();

        if (tab.Note != ActiveNote) return;
        if (OpenNotes.Count == 0)
        {
            ActiveNote = null;
            Editor.Clear();
        }
        else
        {
            OpenNote(OpenNotes[Math.Min(index, OpenNotes.Count - 1)].Note);
        }
    }

    private void DeleteNote_Click(object sender, RoutedEventArgs e)
    {
        if (ActiveNote is null) return;
        ConfirmAndDelete(ActiveNote);
    }

    private void DeleteNoteFromList_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is Button { Tag: Guid id })
        {
            var note = Notes.FirstOrDefault(item => item.Id == id);
            if (note is not null) ConfirmAndDelete(note);
        }
    }

    private void ConfirmAndDelete(Note deleted)
    {
        if (MessageBox.Show(this, $"Czy na pewno usunąć notatkę „{deleted.Title}”?", "Usuń notatkę", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;

        var wasActive = deleted == ActiveNote;
        Notes.Remove(deleted);
        var tab = OpenNotes.FirstOrDefault(open => open.Note == deleted);
        if (tab is not null) OpenNotes.Remove(tab);
        RefreshVisibleTabs();

        if (Notes.Count == 0) Notes.Add(new Note());
        if (wasActive) OpenNote(Notes[0]);
        SaveNotes();
    }

    private void BeginInlineRename(Note note, DependencyObject root, bool inSidebar)
    {
        foreach (var item in Notes)
        {
            item.IsRenamingInSidebar = item == note && inSidebar;
            item.IsRenamingInTab = item == note && !inSidebar;
        }
        Dispatcher.BeginInvoke(() =>
        {
            var editor = FindDescendant<TextBox>(root, box => box.Tag is Guid id && id == note.Id && box.IsVisible);
            if (editor is null) return;
            editor.Text = note.Title;
            FocusAndSelectInlineTitle(editor);
        }, DispatcherPriority.Input);
    }

    private static void FocusAndSelectInlineTitle(TextBox editor)
    {
        if (editor is not Emoji.Wpf.TextBox emojiEditor)
        {
            editor.Focus();
            editor.SelectAll();
            return;
        }
        emojiEditor.ApplyTemplate();
        if (FindDescendant<Emoji.Wpf.RichTextBox>(emojiEditor, _ => true) is not { } richEditor)
        {
            editor.Focus();
            editor.SelectAll();
            return;
        }
        richEditor.Focus();
        richEditor.SelectAll();
    }

    private void InlineTitle_KeyDown(object sender, KeyEventArgs e)
    {
        if (sender is not TextBox editor) return;
        var note = NoteForEditor(editor);
        if (note is null) return;

        if (e.Key == Key.Enter)
        {
            CommitInlineRename(editor, note);
            Editor.Focus();
            e.Handled = true;
        }
        else if (e.Key == Key.Escape)
        {
            editor.Text = note.Title;
            note.IsRenamingInSidebar = false;
            note.IsRenamingInTab = false;
            Editor.Focus();
            e.Handled = true;
        }
    }

    private void InlineTitle_LostFocus(object sender, RoutedEventArgs e)
    {
        if (sender is not TextBox editor || NoteForEditor(editor) is not Note note || !note.IsRenaming) return;
        editor.Text = note.Title;
        note.IsRenamingInSidebar = false;
        note.IsRenamingInTab = false;
    }

    private Note? NoteForEditor(TextBox editor)
    {
        if (editor.DataContext is Note note) return note;
        if (editor.DataContext is OpenNote open) return open.Note;
        return editor.Tag is Guid id ? Notes.FirstOrDefault(item => item.Id == id) : null;
    }

    private void CommitInlineRename(TextBox editor, Note note)
    {
        var title = editor.Text.Trim();
        if (title.Length > 0) note.Title = title;
        note.IsRenamingInSidebar = false;
        note.IsRenamingInTab = false;
        OpenNotes.FirstOrDefault(open => open.Note == note)?.RefreshTitle();
        SaveNotes();
    }

    private static T? FindAncestor<T>(DependencyObject source) where T : DependencyObject
    {
        var current = source;
        while (current is not null)
        {
            if (current is T match) return match;
            current = current switch
            {
                System.Windows.Media.Visual or System.Windows.Media.Media3D.Visual3D => System.Windows.Media.VisualTreeHelper.GetParent(current),
                FrameworkContentElement content => content.Parent,
                _ => LogicalTreeHelper.GetParent(current)
            };
        }
        return null;
    }

    private static T? FindDescendant<T>(DependencyObject root, Func<T, bool> predicate) where T : DependencyObject
    {
        for (var index = 0; index < System.Windows.Media.VisualTreeHelper.GetChildrenCount(root); index++)
        {
            var child = System.Windows.Media.VisualTreeHelper.GetChild(root, index);
            if (child is T match && predicate(match)) return match;
            var nested = FindDescendant(child, predicate);
            if (nested is not null) return nested;
        }
        return null;
    }

    private void Editor_DocumentChanged(object? sender, DocumentChangedEventArgs e)
    {
        var note = Notes.FirstOrDefault(item => item.Id == e.NoteId);
        if (note is null || (note.DocumentJson == e.DocumentJson && note.Content == e.Markdown)) return;
        note.Content = e.Markdown;
        note.DocumentJson = e.DocumentJson;
        OpenNotes.FirstOrDefault(open => open.Note == note)?.RefreshTitle();
        ScheduleSave();
    }

    private void ScheduleSave()
    {
        _saveTimer.Stop();
        _saveTimer.Start();
    }

    private bool SaveNotes()
    {
        if (_loadFailed) return false;
        try
        {
            _store.Save(Notes);
            Title = "Notarium";
            return true;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            MessageBox.Show(this, $"Nie udało się zapisać notatek.\n\n{error.Message}", "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
    }

    private void Editor_SelectionChanged(object? sender, EventArgs e)
    {
        FontFamilyButton.Content = $"{Editor.CurrentFont} ▾";
        ContentWidthButton.Content = Editor.CurrentContentWidth == 0 ? "↔ ∞" : $"↔ {Editor.CurrentContentWidth}";
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 2)
        {
            WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
            return;
        }
        if (e.ButtonState == MouseButtonState.Pressed) DragMove();
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void MaximizeButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    private void CloseButton_Click(object sender, RoutedEventArgs e) => Close();

    private void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (!IsLoaded) return;
        SearchHint.Visibility = string.IsNullOrEmpty(SearchBox.Text) ? Visibility.Visible : Visibility.Collapsed;
        var query = SearchBox.Text.Trim();
        CollectionViewSource.GetDefaultView(Notes).Filter = item =>
            item is Note note && (query.Length == 0 || note.Title.Contains(query, StringComparison.CurrentCultureIgnoreCase) || note.Content.Contains(query, StringComparison.CurrentCultureIgnoreCase));
    }

    private void FavoriteButton_Click(object sender, RoutedEventArgs e)
    {
        if (ActiveNote is null) return;
        ActiveNote.IsFavorite = !ActiveNote.IsFavorite;
        SaveNotes();
    }

    private void SidebarFavoriteButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: Guid id }) return;
        var note = Notes.FirstOrDefault(item => item.Id == id);
        if (note is null) return;
        note.IsFavorite = !note.IsFavorite;
        SaveNotes();
        e.Handled = true;
    }

    private CleanPopupMenu CreatePopupMenu(object sender, double? itemWidth = null)
    {
        return new CleanPopupMenu(sender as UIElement, itemWidth);
    }

    private static Style PopupMenuItemStyle() =>
        (Style)Application.Current.FindResource("PopupMenuItemStyle");

    private void OpenFile_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Title = "Open note",
            Filter = "Markdown and text files (*.md;*.txt)|*.md;*.txt|All files (*.*)|*.*"
        };
        if (dialog.ShowDialog(this) != true) return;

        try
        {
            var note = new Note { Content = File.ReadAllText(dialog.FileName) };
            Notes.Insert(0, note);
            OpenNote(note);
            SaveNotes();
        }
        catch (Exception exception)
        {
            MessageBox.Show(this, $"Nie udało się otworzyć pliku.\n\n{exception.Message}", "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void SaveFile_Click(object sender, RoutedEventArgs e)
    {
        try { await Editor.FlushAsync(); }
        catch (Exception error) { MessageBox.Show(this, error.Message, "Nie udało się pobrać notatki"); return; }
        if (ActiveNote is null) return;
        var invalid = Path.GetInvalidFileNameChars();
        var suggestedName = new string(ActiveNote.Title.Where(character => !invalid.Contains(character)).ToArray()).Trim();
        if (string.IsNullOrWhiteSpace(suggestedName) || suggestedName == "Bez tytułu") suggestedName = "notatka";

        var dialog = new SaveFileDialog
        {
            Title = "Save active note",
            Filter = "Markdown file (*.md)|*.md|Text file (*.txt)|*.txt",
            FileName = suggestedName + ".md",
            DefaultExt = ".md",
            AddExtension = true
        };
        if (dialog.ShowDialog(this) != true) return;

        try
        {
            File.WriteAllText(dialog.FileName, ActiveNote.Content, new System.Text.UTF8Encoding(false));
        }
        catch (Exception exception)
        {
            MessageBox.Show(this, $"Nie udało się zapisać pliku.\n\n{exception.Message}", "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void HelpMenu_Click(object sender, RoutedEventArgs e)
    {
        MessageBox.Show(this,
            "Notarium\n\nMinimalistyczna aplikacja do tworzenia i organizowania notatek.\n\nAutor: Arkad",
            "About Notarium",
            MessageBoxButton.OK,
            MessageBoxImage.Information);
    }

    private void TabsHost_SizeChanged(object sender, SizeChangedEventArgs e) => RefreshVisibleTabs();

    private void RefreshVisibleTabs(OpenNote? ensureVisible = null)
    {
        if (!IsLoaded && TabsHost.ActualWidth <= 0) return;
        var totalWidth = Math.Max(200, TabsHost.ActualWidth);
        const double minimumTabWidth = 96;
        const double maximumTabWidth = 205;
        const double addButtonWidth = 46;

        var widthWithoutArrows = Math.Max(100, totalWidth - addButtonWidth);
        var allFit = OpenNotes.Count == 0 || OpenNotes.Count * (minimumTabWidth - 7) <= widthWithoutArrows;
        var availableForTabs = Math.Max(96, widthWithoutArrows - (allFit ? 0 : 72));
        _tabPageSize = allFit
            ? Math.Max(1, OpenNotes.Count)
            : Math.Max(1, (int)Math.Floor(availableForTabs / (minimumTabWidth - 7)));

        if (ensureVisible is not null)
        {
            var activeIndex = OpenNotes.IndexOf(ensureVisible);
            if (activeIndex < _tabPageStart) _tabPageStart = activeIndex;
            if (activeIndex >= _tabPageStart + _tabPageSize) _tabPageStart = activeIndex - _tabPageSize + 1;
        }

        _tabPageStart = Math.Clamp(_tabPageStart, 0, Math.Max(0, OpenNotes.Count - _tabPageSize));
        var visibleCount = Math.Min(_tabPageSize, Math.Max(0, OpenNotes.Count - _tabPageStart));
        TabWidth = visibleCount == 0 ? maximumTabWidth : Math.Clamp((availableForTabs / visibleCount) + 7, minimumTabWidth, maximumTabWidth);

        VisibleTabs.Clear();
        foreach (var tab in OpenNotes.Skip(_tabPageStart).Take(_tabPageSize)) VisibleTabs.Add(tab);

        LeftTabsButton.Visibility = _tabPageStart > 0 ? Visibility.Visible : Visibility.Collapsed;
        RightTabsButton.Visibility = _tabPageStart + _tabPageSize < OpenNotes.Count ? Visibility.Visible : Visibility.Collapsed;
    }

    private void PreviousTabs_Click(object sender, RoutedEventArgs e)
    {
        _tabPageStart = Math.Max(0, _tabPageStart - _tabPageSize);
        RefreshVisibleTabs();
    }

    private void NextTabs_Click(object sender, RoutedEventArgs e)
    {
        _tabPageStart = Math.Min(Math.Max(0, OpenNotes.Count - 1), _tabPageStart + _tabPageSize);
        RefreshVisibleTabs();
    }

    private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.N)
        {
            NewNote_Click(sender, e);
            e.Handled = true;
        }
        else if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.O)
        {
            OpenFile_Click(sender, e);
            e.Handled = true;
        }
        else if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.S)
        {
            SaveFile_Click(sender, e);
            e.Handled = true;
        }
        else if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.B)
        {
            Editor.Execute("bold");
            e.Handled = true;
        }
        else if (Keyboard.Modifiers == ModifierKeys.Control && e.Key == Key.I)
        {
            Editor.Execute("italic");
            e.Handled = true;
        }
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
            MessageBox.Show(this, "Nie udało się odebrać ostatnich zmian. Okno pozostaje otwarte.\n\n" + error.Message, "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally { _closingInProgress = false; }
    }
    private void Exit_Click(object sender, RoutedEventArgs e) => Close();

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
