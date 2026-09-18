using System.IO;
using System.Text.Json;

namespace Notatnik;

public sealed class NoteStore
{
    private readonly string _path;

    public NoteStore(string? path = null) => _path = path ?? Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Notatnik", "notes.json");

    public List<Note> Load()
    {
        if (!File.Exists(_path)) return new();
        using var stream = File.OpenRead(_path);
        var stored = JsonSerializer.Deserialize<List<StoredNote>>(stream)
            ?? throw new InvalidDataException("Plik notatek nie zawiera biblioteki.");
        return stored.Select(item => new Note
        {
            Id = item.Id,
            Content = item.Content ?? string.Empty,
            DocumentJson = item.DocumentJson,
            CustomTitle = item.CustomTitle,
            IsFavorite = item.IsFavorite,
            CreatedAtUtc = item.CreatedAtUtc,
            SavedAtUtc = item.SavedAtUtc,
            UpdatedAtUtc = item.UpdatedAtUtc
        }).ToList();
    }

    public void Save(IEnumerable<Note> notes)
    {
        var snapshot = notes.ToList();
        var savedAt = DateTime.UtcNow;
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(_path))!);
        var migrationBackup = _path + ".pre-tiptap.json";
        if (File.Exists(_path) && !File.Exists(migrationBackup) && snapshot.Any(note => note.DocumentJson is not null))
            File.Copy(_path, migrationBackup);
        var temporary = _path + ".tmp";
        try
        {
            using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                JsonSerializer.Serialize(stream, snapshot.Select(note => new StoredNote
                {
                    Id = note.Id,
                    Content = note.Content,
                    DocumentJson = note.DocumentJson,
                    CustomTitle = note.CustomTitle,
                    IsFavorite = note.IsFavorite,
                    CreatedAtUtc = note.CreatedAtUtc,
                    SavedAtUtc = savedAt,
                    UpdatedAtUtc = note.UpdatedAtUtc
                }));
                stream.Flush(flushToDisk: true);
            }
            if (File.Exists(_path)) File.Replace(temporary, _path, _path + ".bak");
            else File.Move(temporary, _path);
            foreach (var note in snapshot) note.SavedAtUtc = savedAt;
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
    }

    // Explicit storage contract excludes transient UI state and setter side effects.
    private sealed class StoredNote
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string? Content { get; set; }
        public string? DocumentJson { get; set; }
        public string? CustomTitle { get; set; }
        public bool IsFavorite { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? SavedAtUtc { get; set; }
    }
}
