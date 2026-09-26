using System.Windows.Threading;
namespace Notatnik;

public sealed class NotebookAutosave : IDisposable
{
    private readonly DispatcherTimer _timer;
    public NotebookAutosave(Action save)
    {
        _timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(550) };
        _timer.Tick += (_, _) => { Stop(); save(); };
    }
    public void Schedule() { Stop(); _timer.Start(); }
    public void Stop() => _timer.Stop();
    public void Dispose() => Stop();
}
