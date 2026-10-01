using System.IO;
using System.Text.Json;

namespace Notatnik;

public sealed record RecentFile(string Path, Guid NoteId, DateTime LastUsedUtc);

public sealed class RecentFilesStore
{
    private readonly string _path;

    public RecentFilesStore(string? path = null) => _path = path ?? System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Notatnik", "recent-files.json");

    public IReadOnlyList<RecentFile> Load()
    {
        if (!File.Exists(_path)) return Array.Empty<RecentFile>();
        using var stream = File.OpenRead(_path);
        return JsonSerializer.Deserialize<List<RecentFile>>(stream) ?? new List<RecentFile>();
    }

    public void Record(string path, Guid noteId)
    {
        var fullPath = System.IO.Path.GetFullPath(path);
        var entries = Load().Where(item => !string.Equals(item.Path, fullPath, StringComparison.OrdinalIgnoreCase))
            .Prepend(new RecentFile(fullPath, noteId, DateTime.UtcNow)).Take(30).ToArray();
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(System.IO.Path.GetFullPath(_path))!);
        var temporary = _path + ".tmp";
        try
        {
            using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                JsonSerializer.Serialize(stream, entries);
                stream.Flush(flushToDisk: true);
            }
            if (File.Exists(_path)) File.Replace(temporary, _path, _path + ".bak");
            else File.Move(temporary, _path);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
