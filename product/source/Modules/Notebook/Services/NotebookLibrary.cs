using System.Collections.ObjectModel;
namespace Notatnik;

public sealed class NotebookLibrary
{
    private readonly NoteStore _store;
    public ObservableCollection<Note> Notes { get; } = new();
    public Note? ActiveNote { get; set; }
    public NotebookLibrary(NoteStore store) => _store = store;
    public void Load()
    {
        // Read first: failed imports never replace an existing in-memory library.
        var loaded = _store.Load().OrderByDescending(note => note.UpdatedAtUtc).ToArray();
        Notes.Clear(); foreach (var note in loaded) Notes.Add(note);
    }
    public Note Create()
    {
        var note = new Note(); Notes.Insert(0, note); return note;
    }
    public void Save() => _store.Save(Notes);
    public Note Import(string content) { var note = new Note { Content = content }; Notes.Insert(0, note); return note; }
    public void Remove(Note note) { Notes.Remove(note); if (Notes.Count == 0) Notes.Add(new Note()); }
    public void BeginRename(Note note, bool sidebar)
    {
        foreach (var item in Notes) { item.IsRenamingInSidebar = item == note && sidebar; item.IsRenamingInTab = item == note && !sidebar; }
    }
    public void CancelRename(Note note) { note.IsRenamingInSidebar = false; note.IsRenamingInTab = false; }
    public void Rename(Note note, string title) { if (title.Trim().Length > 0) note.Title = title.Trim(); CancelRename(note); }
    public void ToggleFavorite(Note note) => note.IsFavorite = !note.IsFavorite;
    public bool Matches(Note note, string query) => query.Length == 0 || note.Title.Contains(query, StringComparison.CurrentCultureIgnoreCase) || note.Content.Contains(query, StringComparison.CurrentCultureIgnoreCase);
    public bool Update(Guid id, string markdown, string? documentJson)
    {
        var note = Notes.FirstOrDefault(item => item.Id == id);
        if (note is null || note.DocumentJson == documentJson && note.Content == markdown) return false;
        note.Content = markdown; note.DocumentJson = documentJson; return true;
    }
}
