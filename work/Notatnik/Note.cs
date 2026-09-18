using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json.Serialization;

namespace Notatnik;

public sealed class Note : INotifyPropertyChanged
{
    private string _content = string.Empty;
    private string? _displayText;
    private string? _documentJson;
    private bool _isFavorite;
    private string? _title;
    private bool _isRenamingInSidebar;
    private bool _isRenamingInTab;

    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    private DateTime? _savedAtUtc;
    public DateTime? SavedAtUtc { get => _savedAtUtc; set { _savedAtUtc = value; OnPropertyChanged(nameof(SavedAtText)); } }
    [JsonIgnore] public string SavedAtText => SavedAtUtc is DateTime saved ? $"Ostatni zapis: {saved.ToLocalTime():dd.MM.yyyy, HH:mm:ss}" : "Ostatni zapis: —";

    [JsonIgnore]
    public bool IsRenamingInSidebar { get => _isRenamingInSidebar; set { if (_isRenamingInSidebar == value) return; _isRenamingInSidebar = value; OnPropertyChanged(); } }
    [JsonIgnore]
    public bool IsRenamingInTab { get => _isRenamingInTab; set { if (_isRenamingInTab == value) return; _isRenamingInTab = value; OnPropertyChanged(); } }
    [JsonIgnore]
    public bool IsRenaming => IsRenamingInSidebar || IsRenamingInTab;

    public bool IsFavorite
    {
        get => _isFavorite;
        set
        {
            if (_isFavorite == value) return;
            _isFavorite = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(FavoriteGlyph));
            OnPropertyChanged(nameof(FavoriteColor));
        }
    }

    [JsonInclude]
    public string? CustomTitle
    {
        get => _title;
        set { _title = value; OnPropertyChanged(nameof(Title)); }
    }

    [JsonIgnore] public string FavoriteGlyph => IsFavorite ? "★" : "☆";
    [JsonIgnore] public string FavoriteColor => IsFavorite ? "#F2C94C" : "#858585";
    [JsonIgnore] public string CreatedAtText => $"Utworzono: {CreatedAtUtc.ToLocalTime():dd.MM.yyyy, HH:mm}";

    public string Content
    {
        get => _content;
        set
        {
            if (_content == value) return;
            _content = value;
            _displayText = null;
            UpdatedAtUtc = DateTime.UtcNow;
            OnPropertyChanged();
            OnPropertyChanged(nameof(Title));
            OnPropertyChanged(nameof(Preview));
        }
    }

    public string? DocumentJson
    {
        get => _documentJson;
        set
        {
            if (_documentJson == value) return;
            _documentJson = value;
            _displayText = null;
            UpdatedAtUtc = DateTime.UtcNow;
            OnPropertyChanged(); OnPropertyChanged(nameof(Title)); OnPropertyChanged(nameof(Preview));
        }
    }

    [JsonIgnore]
    public string Title
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(_title)) return _title;
            var firstLine = DisplayText.Replace("\r", string.Empty).Split('\n').FirstOrDefault()?.Trim();
            if (string.IsNullOrWhiteSpace(firstLine)) return "Bez tytułu";
            return firstLine.Length > 42 ? firstLine[..42] + "…" : firstLine;
        }
        set
        {
            var normalized = value.Trim();
            if (_title == normalized) return;
            _title = normalized;
            OnPropertyChanged();
        }
    }

    [JsonIgnore]
    public string Preview
    {
        get
        {
            var lines = DisplayText.Replace("\r", string.Empty).Split('\n')
                .Select(line => line.Trim()).Where(line => line.Length > 0);
            if (string.IsNullOrWhiteSpace(_title)) lines = lines.Skip(1);
            lines = lines.Take(2);
            var preview = string.Join("  ", lines);
            return preview.Length > 58 ? preview[..58] + "…" : preview;
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    [JsonIgnore]
    private string DisplayText => _displayText ??= _documentJson is not null ? ReadRichText() : LegacyDisplayText;

    private string ReadRichText()
    {
        try { return Core.RichDocumentText.Extract(_documentJson!); }
        catch (Exception error) when (error is System.Text.Json.JsonException or KeyNotFoundException or InvalidOperationException) { return LegacyDisplayText; }
    }

    private string LegacyDisplayText => Core.MarkdownPlainText.Extract(Content);
    private void OnPropertyChanged([CallerMemberName] string? propertyName = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
