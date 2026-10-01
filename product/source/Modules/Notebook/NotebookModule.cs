using Notarium.Contracts;
using System.Windows;
namespace Notatnik;
public sealed class NotebookModule : INotariumModule, IRecentDocumentsModule
{
    public string Id => "notebook";
    public string DisplayName => "Notatnik";
    public Window CreateWindow() => new MainWindow();
    public IReadOnlyList<RecentDocument> GetRecentDocuments()
    {
        var files = new RecentFilesStore().Load().Where(item => System.IO.File.Exists(item.Path))
            .Select(item => new RecentDocument("file:" + item.Path, System.IO.Path.GetFileName(item.Path), item.Path, item.LastUsedUtc, true));
        var notes = new NoteStore().Load().Where(note => !string.IsNullOrWhiteSpace(note.Content) || !string.IsNullOrWhiteSpace(note.DocumentJson) || !string.IsNullOrWhiteSpace(note.CustomTitle))
            .Select(note => new RecentDocument("note:" + note.Id, note.Title, "Notatnik · biblioteka", note.LastOpenedAtUtc ?? note.UpdatedAtUtc, false));
        return files.Concat(notes).OrderByDescending(item => item.LastUsedUtc).Take(20).ToArray();
    }
    public bool OpenRecentDocument(Window window, string id)
    {
        if (window is not MainWindow notebook) return false;
        if (id.StartsWith("note:", StringComparison.Ordinal) && Guid.TryParse(id[5..], out var noteId)) return notebook.OpenRecentNote(noteId);
        if (id.StartsWith("file:", StringComparison.Ordinal)) return notebook.OpenRecentFile(id[5..]);
        return false;
    }
}
