using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using Notarium.WebHost;
namespace Notarium.Dev;

public sealed class DevWebGallery : UserControl, IDisposable
{
    private readonly WebView2 _web = new();
    private readonly TextBlock _status = new() { Text = "Uruchamianie galerii…", Margin = new Thickness(20), Foreground = System.Windows.Media.Brushes.White };
    private readonly TaskCompletionSource<bool> _ready = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private bool _starting, _disposed;
    public Task Ready => _ready.Task;
    public string? Error { get; private set; }
    public string? DataDirectory { get; set; }
    public DevWebGallery()
    {
        var grid = new Grid(); grid.Children.Add(_web); grid.Children.Add(_status); Content = grid;
        Loaded += async (_, _) => await Start();
    }
    private async Task Start()
    {
        if (_starting || _disposed) return; _starting = true;
        try
        {
            var assembly = typeof(DevWebGallery).Assembly;
            ModuleWebRuntime.Configure(assembly);
            var files = new Dictionary<string, byte[]>();
            foreach (var name in new[] { "index.html", "gallery.js", "gallery.css" })
            {
                using var stream = assembly.GetManifestResourceStream("Notarium.Dev.Web." + name) ?? throw new InvalidOperationException("Brak zasobów galerii DEV. Zbuduj WebGallery przed kompilacją.");
                using var bytes = new MemoryStream(); stream.CopyTo(bytes); files[name] = bytes.ToArray();
            }
            var root = DataDirectory ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Notarium", "dev-gallery");
            var hash = Convert.ToHexString(SHA256.HashData(files.SelectMany(file => file.Value).ToArray()))[..20];
            var assets = Path.Combine(root, "assets", hash); Directory.CreateDirectory(assets);
            foreach (var (name, bytes) in files) { var path = Path.Combine(assets, name); if (!File.Exists(path)) File.WriteAllBytes(path, bytes); }
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(root, "runtime"));
            if (_disposed) return;
            await _web.EnsureCoreWebView2Async(environment); if (_disposed) return;
            _web.DefaultBackgroundColor = System.Drawing.Color.FromArgb(37, 37, 37);
            var core = _web.CoreWebView2; core.Settings.IsStatusBarEnabled = false; core.Settings.AreDefaultContextMenusEnabled = false;
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.SetVirtualHostNameToFolderMapping("dev.notarium.local", assets, CoreWebView2HostResourceAccessKind.DenyCors);
            core.NavigationStarting += (_, e) => { if (e.Uri != "https://dev.notarium.local/index.html") e.Cancel = true; };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.WebMessageReceived += (_, e) => { if (e.Source == "https://dev.notarium.local/index.html" && e.TryGetWebMessageAsString() == "ready") { _status.Visibility = Visibility.Collapsed; _ready.TrySetResult(true); } };
            core.NavigationCompleted += (_, e) => { if (!e.IsSuccess) Fail("Nie udało się załadować galerii: " + e.WebErrorStatus); };
            core.Navigate("https://dev.notarium.local/index.html");
        }
        catch (Exception error) { Fail(error.Message); }
    }
    private void Fail(string message) { Error = message; _status.Text = "Galeria DEV: " + message; _ready.TrySetException(new InvalidOperationException(message)); }
    public void Dispose() { if (_disposed) return; _disposed = true; _web.Dispose(); _ready.TrySetCanceled(); }
}
