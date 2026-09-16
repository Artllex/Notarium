using System.ComponentModel;

namespace Notatnik;

public sealed class OpenNote : INotifyPropertyChanged
{
    private bool _isActive;
    public Note Note { get; }
    public string Title => Note.Title;
    public bool IsActive
    {
        get => _isActive;
        set { if (_isActive == value) return; _isActive = value; PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsActive))); }
    }

    public OpenNote(Note note) => Note = note;
    public void RefreshTitle() => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Title)));
    public event PropertyChangedEventHandler? PropertyChanged;
}
