using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Data;
using System.Windows.Documents;
using Microsoft.Win32;
using System.IO;
using Notarium.UI;

namespace Notatnik;

// Window event adapters only; state and policies live in Services.
public partial class MainWindow
{
    private void NewNote_Click(object sender, RoutedEventArgs e)
    {
        var note = _library.Create();
        OpenNote(note);
        Editor.Focus();
        ScheduleSave();
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
        if (DialogService.Show(this, $"Czy na pewno usunąć notatkę „{deleted.Title}”?", "Usuń notatkę", MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes) return;

        var wasActive = deleted == ActiveNote;
        _library.Remove(deleted);
        var tab = OpenNotes.FirstOrDefault(open => open.Note == deleted);
        if (tab is not null) OpenNotes.Remove(tab);
        RefreshVisibleTabs();

        if (wasActive) OpenNote(Notes[0]);
        SaveNotes();
    }

    private void BeginInlineRename(Note note, DependencyObject root, bool inSidebar)
    {
        _library.BeginRename(note, inSidebar);
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
        CommitInlineRename(editor, note);
    }

    private Note? NoteForEditor(TextBox editor)
    {
        if (editor.DataContext is Note note) return note;
        if (editor.DataContext is OpenNote open) return open.Note;
        return editor.Tag is Guid id ? Notes.FirstOrDefault(item => item.Id == id) : null;
    }

    private void CommitInlineRename(TextBox editor, Note note)
    {
        if (!note.IsRenaming) return;
        var title = editor is Emoji.Wpf.TextBox emojiEditor &&
            FindDescendant<Emoji.Wpf.RichTextBox>(emojiEditor, _ => true) is { } richEditor
            ? new TextRange(richEditor.Document.ContentStart, richEditor.Document.ContentEnd).Text
            : editor.Text;
        _library.Rename(note, title);
        OpenNotes.FirstOrDefault(open => open.Note == note)?.RefreshTitle();
        SaveNotes();
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

    private void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        if (!IsLoaded) return;
        SearchHint.Visibility = string.IsNullOrEmpty(SearchBox.Text) ? Visibility.Visible : Visibility.Collapsed;
        var query = SearchBox.Text.Trim();
        CollectionViewSource.GetDefaultView(Notes).Filter = item =>
            item is Note note && _library.Matches(note, query);
    }

    private void FavoriteButton_Click(object sender, RoutedEventArgs e)
    {
        if (ActiveNote is null) return;
        _library.ToggleFavorite(ActiveNote);
        SaveNotes();
    }

    private void SidebarFavoriteButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: Guid id }) return;
        var note = Notes.FirstOrDefault(item => item.Id == id);
        if (note is null) return;
        _library.ToggleFavorite(note);
        SaveNotes();
        e.Handled = true;
    }

}
