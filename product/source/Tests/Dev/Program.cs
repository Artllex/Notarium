using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Notarium.Dev;
using Notarium.Shell;
using Notarium.UI;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        var count = 0;
        void Check(bool value, string name) { if (!value) throw new InvalidOperationException(name); Console.WriteLine("PASS " + name); count++; }
        var app = new Application(); app.Resources.MergedDictionaries.Add(new ResourceDictionary { Source = new Uri("pack://application:,,,/Notarium.UI;component/Theme.xaml") });
        var fixture = Path.Combine(Path.GetTempPath(), "Notarium-Dev-tests-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(fixture);
        var missing = new ModuleCatalog(Path.Combine(fixture, "missing-modules"));
        Check(missing.Entries.Select(entry => entry.Id).SequenceEqual(new[] { "notebook", "calendar", "collections", "prompting", "dev" }), "all planned modules visible without files");
        Check(missing.Entries.All(entry => !entry.IsAvailable) && missing.Errors.Count == 0, "missing implementation is a normal state");
        var module = new DevModule(); Check(module.Id == "dev", "DEV implements the module contract");
        var window = (DevWindow)module.CreateWindow();
        Check(window.Samples.Children.OfType<MenuBar>().Count() == 1 && window.Samples.Children.OfType<ToolPanel>().Count() == 1 && window.Samples.Children.OfType<TabCard>().Count() == 1, "gallery composes actual shared WPF components");
        var native = window.WebGallery; native.DataDirectory = Path.Combine(fixture, "web");
        var tabs = (TabControl)window.Content; tabs.SelectedIndex = 1; window.Opacity = 0; window.ShowInTaskbar = false; window.Show();
        var frame = new DispatcherFrame(); var deadline = DateTime.UtcNow.AddSeconds(25); var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(100) };
        timer.Tick += (_, _) => { if (native.Ready.IsCompleted || DateTime.UtcNow > deadline) frame.Continue = false; };
        timer.Start(); Dispatcher.PushFrame(frame); timer.Stop();
        Check(native.Ready.IsCompletedSuccessfully && native.Error is null, "real DEV WebView2 reaches gallery ready: " + native.Error);
        window.Close(); app.Shutdown(); Console.WriteLine($"TOTAL {count} DEV checks passed; fixture: {fixture}");
    }
}
