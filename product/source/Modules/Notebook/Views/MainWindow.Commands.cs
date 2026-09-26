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

// Window event adapters only; state and policies live in Services.
public partial class MainWindow
{
    private void OpenNote(Note note)
    {
        if (ActiveNote == note) { Editor.Focus(); return; }
        var tab = _tabs.Activate(note);
        RefreshVisibleTabs(tab);
        ActiveNote = note;
        NotesList.SelectedItem = note;

        Editor.OpenNote(note.Id, note.Content, note.DocumentJson);
        Editor.Focus();
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void MaximizeButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    private void CloseButton_Click(object sender, RoutedEventArgs e) => Close();

    private DropDownMenu CreatePopupMenu(object sender, double? itemWidth = null)
    {
        return new DropDownMenu(sender as UIElement, itemWidth);
    }

    private void OpenFile_Click(object sender, RoutedEventArgs e)
    {
        var dialog = DialogService.OpenFile("Open note", "Markdown and text files (*.md;*.txt)|*.md;*.txt|All files (*.*)|*.*");
        if (dialog.ShowDialog(this) != true) return;

        try
        {
            var note = _library.Import(File.ReadAllText(dialog.FileName));
            OpenNote(note);
            SaveNotes();
        }
        catch (Exception exception)
        {
            DialogService.Show(this, $"Nie udało się otworzyć pliku.\n\n{exception.Message}", "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private async void SaveFile_Click(object sender, RoutedEventArgs e)
    {
        try { await Editor.FlushAsync(); }
        catch (Exception error) { DialogService.Show(this, error.Message, "Nie udało się pobrać notatki"); return; }
        if (ActiveNote is null) return;
        var invalid = Path.GetInvalidFileNameChars();
        var suggestedName = new string(ActiveNote.Title.Where(character => !invalid.Contains(character)).ToArray()).Trim();
        if (string.IsNullOrWhiteSpace(suggestedName) || suggestedName == "Bez tytułu") suggestedName = "notatka";

        var dialog = DialogService.SaveFile("Save active note", "Markdown file (*.md)|*.md|Text file (*.txt)|*.txt", suggestedName + ".md", ".md");
        if (dialog.ShowDialog(this) != true) return;

        try
        {
            File.WriteAllText(dialog.FileName, ActiveNote.Content, new System.Text.UTF8Encoding(false));
        }
        catch (Exception exception)
        {
            DialogService.Show(this, $"Nie udało się zapisać pliku.\n\n{exception.Message}", "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void PersistentHighlights_Click(object sender, RoutedEventArgs e)
    {
        Editor.Execute("persistentHighlights", PersistentHighlightsMenuItem.IsChecked.ToString().ToLowerInvariant());
        Editor.Focus();
    }

    private void MetadataMenu_Click(object sender, RoutedEventArgs e)
    {
        if (ActiveNote is null) return;
        DialogService.Show(this, $"Tytuł pliku: {ActiveNote.Title}\nPodtytuł: —\nOpis: —\nAutor: —", "File metadata", MessageBoxButton.OK, MessageBoxImage.Information);
    }


    private void HelpMenu_Click(object sender, RoutedEventArgs e)
    {
        DialogService.Show(this,
            "Notarium\n\nMinimalistyczna aplikacja do tworzenia i organizowania notatek.\n\nAutor: Arkad",
            "About Notarium",
            MessageBoxButton.OK,
            MessageBoxImage.Information);
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

    private void Exit_Click(object sender, RoutedEventArgs e) => Close();

}
