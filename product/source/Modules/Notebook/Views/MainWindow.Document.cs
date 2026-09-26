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
    private void Editor_DocumentChanged(object? sender, DocumentChangedEventArgs e)
    {
        if (!_library.Update(e.NoteId, e.Markdown, e.DocumentJson)) return;
        var note = Notes.First(item => item.Id == e.NoteId);
        OpenNotes.FirstOrDefault(open => open.Note == note)?.RefreshTitle();
        ScheduleSave();
    }

    private void ScheduleSave()
    {
        _saveTimer.Schedule();
    }

    private bool SaveNotes()
    {
        if (_loadFailed) return false;
        try
        {
            _library.Save();
            Title = "Notarium";
            return true;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            DialogService.Show(this, $"Nie udało się zapisać notatek.\n\n{error.Message}", "Notarium", MessageBoxButton.OK, MessageBoxImage.Error);
            return false;
        }
    }

    private void Editor_SelectionChanged(object? sender, EventArgs e)
    {
        FontFamilyButton.Content = $"{Editor.CurrentFont} ▾";
        ContentWidthButton.Content = Editor.CurrentContentWidth == 0 ? "↔ ∞" : $"↔ {Editor.CurrentContentWidth}";
    }

}
