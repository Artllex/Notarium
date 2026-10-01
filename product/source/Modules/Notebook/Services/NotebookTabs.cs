using System.Collections.ObjectModel;
namespace Notatnik;

public sealed class NotebookTabs
{
    public ObservableCollection<OpenNote> Open { get; } = new();
    public ObservableCollection<OpenNote> Visible { get; } = new();
    public double Width { get; private set; } = 180;
    public int PageStart { get; private set; }
    public int PageSize { get; private set; } = 1;
    public bool CanGoBack => PageStart > 0;
    public bool CanGoNext => PageStart + PageSize < Open.Count;
    public OpenNote Activate(Note note)
    {
        var tab = Open.FirstOrDefault(item => item.Note == note);
        if (tab is null) { tab = new OpenNote(note); Open.Add(tab); }
        foreach (var item in Open) item.IsActive = item == tab;
        return tab;
    }
    public void Refresh(double totalWidth, OpenNote? ensureVisible = null)
    {
        const double minimum = 96, maximum = 205;
        var widthWithoutArrows = Math.Max(100, Math.Max(200, totalWidth) - 46);
        var allFit = Open.Count == 0 || Open.Count * minimum <= widthWithoutArrows;
        var available = Math.Max(96, widthWithoutArrows - (allFit ? 0 : 72));
        PageSize = allFit ? Math.Max(1, Open.Count) : Math.Max(1, (int)Math.Floor(available / minimum));
        if (ensureVisible is not null)
        {
            var index = Open.IndexOf(ensureVisible);
            if (index >= 0 && index < PageStart) PageStart = index;
            if (index >= PageStart + PageSize) PageStart = index - PageSize + 1;
        }
        PageStart = Math.Clamp(PageStart, 0, Math.Max(0, Open.Count - PageSize));
        var count = Math.Min(PageSize, Math.Max(0, Open.Count - PageStart));
        Width = count == 0 ? maximum : Math.Clamp(available / count, minimum, maximum);
        Visible.Clear(); foreach (var tab in Open.Skip(PageStart).Take(PageSize)) Visible.Add(tab);
    }
    public void Previous() => PageStart = Math.Max(0, PageStart - PageSize);
    public void Next() => PageStart = Math.Min(Math.Max(0, Open.Count - 1), PageStart + PageSize);
}
