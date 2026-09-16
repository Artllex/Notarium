using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace Notatnik;

public sealed record DocumentChangedEventArgs(Guid NoteId, string DocumentJson, string Markdown);

/// <summary>Small native host. All editing and history belong to Tiptap/ProseMirror.</summary>
public sealed class WebEditorControl : UserControl, IDisposable
{
    private const string Origin = "https://notatnik.local/";
    private readonly WebView2CompositionControl _web = new();
    private readonly TextBlock _status = new() { Text = "Uruchamianie edytora…", Margin = new Thickness(24), Foreground = System.Windows.Media.Brushes.LightGray };
    private readonly Dictionary<string, TaskCompletionSource<bool>> _flushes = new();
    private object? _pendingDocument;
    private bool _starting, _ready, _disposed;
    private double _spacing = 1.25;
    private int _zoom = 100;
    private readonly TaskCompletionSource<bool> _readyCompletion = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public event EventHandler<DocumentChangedEventArgs>? DocumentChanged;
    public event EventHandler? SelectionChanged;
    public event EventHandler<string>? ShortcutRequested;
    public event EventHandler<string>? EditorError;
    public string CurrentFont { get; private set; } = "Segoe UI";
    public bool CanUndoContent { get; private set; }
    public bool CanRedoContent { get; private set; }
    public bool IsCodeFocused { get; private set; }
    public Task Ready => _readyCompletion.Task;
    public string? DataDirectory { get; set; }
    public double LineSpacingFactor { get => _spacing; set { _spacing = Math.Clamp(value, 1, 2); SendView(); } }

    public WebEditorControl()
    {
        var grid = new Grid(); grid.Children.Add(_web); grid.Children.Add(_status); Content = grid;
        Loaded += async (_, _) => await InitializeAsync();
        CommandBindings.Add(new CommandBinding(ApplicationCommands.Undo, (_, _) => Execute("undo"), (_, e) => e.CanExecute = CanUndoContent));
        CommandBindings.Add(new CommandBinding(ApplicationCommands.Redo, (_, _) => Execute("redo"), (_, e) => e.CanExecute = CanRedoContent));
    }

    private async Task InitializeAsync()
    {
        if (_starting || _disposed) return;
        _starting = true;
        try
        {
            var data = DataDirectory ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Notatnik", "web-editor");
            var assets = ExtractAssets(data);
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(data, "runtime"));
            await _web.EnsureCoreWebView2Async(environment);
            if (_disposed) return;
            var core = _web.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.SetVirtualHostNameToFolderMapping("notatnik.local", assets, CoreWebView2HostResourceAccessKind.DenyCors);
            core.WebMessageReceived += Receive;
            core.NavigationStarting += (_, e) => { if (e.Uri != Origin + "index.html") e.Cancel = true; };
            core.NewWindowRequested += (_, e) => { e.Handled = true; OpenLink(e.Uri); };
            core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
            core.NavigationCompleted += (_, e) => { if (!e.IsSuccess) Fail("Nie udało się uruchomić edytora: " + e.WebErrorStatus); };
            core.ProcessFailed += (_, _) => Fail("Proces edytora został przerwany. Zapisane notatki pozostają na dysku.");
            _web.DefaultBackgroundColor = System.Drawing.Color.FromArgb(30, 30, 30);
            core.Navigate(Origin + "index.html");
        }
        catch (Exception error) { Fail("Nie można uruchomić edytora WebView2. " + error.Message); }
    }

    private static string ExtractAssets(string data)
    {
        var assembly = typeof(WebEditorControl).Assembly;
        var files = new Dictionary<string, byte[]>();
        foreach (var name in new[] { "index.html", "editor.js", "editor.css", "math.css" })
        {
            using var stream = assembly.GetManifestResourceStream("Notatnik.WebAssets." + name)
                ?? throw new InvalidOperationException("Brak plików edytora. Uruchom npm run build przed kompilacją.");
            using var buffer = new MemoryStream(); stream.CopyTo(buffer); files[name] = buffer.ToArray();
        }
        var hash = Convert.ToHexString(SHA256.HashData(files.SelectMany(pair => pair.Value).ToArray()))[..20];
        var directory = Path.Combine(data, "assets", hash); Directory.CreateDirectory(directory);
        foreach (var (name, bytes) in files)
        {
            var path = Path.Combine(directory, name);
            if (!File.Exists(path) || !File.ReadAllBytes(path).SequenceEqual(bytes)) File.WriteAllBytes(path, bytes);
        }
        return directory;
    }

    private void Receive(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        if (args.Source != Origin + "index.html") return;
        try
        {
            using var document = JsonDocument.Parse(args.WebMessageAsJson);
            var message = document.RootElement;
            switch (message.GetProperty("type").GetString())
            {
                case "ready":
                    _ready = true; _status.Visibility = Visibility.Collapsed;
                    if (_pendingDocument is not null) Send(_pendingDocument);
                    SendView(); _readyCompletion.TrySetResult(true); break;
                case "changed": ApplySnapshot(message); break;
                case "flushed":
                    if (message.GetProperty("changed").GetBoolean()) ApplySnapshot(message);
                    if (_flushes.Remove(message.GetProperty("requestId").GetString()!, out var waiter)) waiter.TrySetResult(true);
                    break;
                case "selection":
                    CurrentFont = message.GetProperty("font").GetString() ?? "Segoe UI";
                    CanUndoContent = message.GetProperty("canUndo").GetBoolean(); CanRedoContent = message.GetProperty("canRedo").GetBoolean();
                    IsCodeFocused = message.GetProperty("inCode").GetBoolean();
                    SelectionChanged?.Invoke(this, EventArgs.Empty); CommandManager.InvalidateRequerySuggested(); break;
                case "openLink": OpenLink(message.GetProperty("url").GetString()); break;
                case "shortcut": ShortcutRequested?.Invoke(this, message.GetProperty("key").GetString()!); break;
                case "error": EditorError?.Invoke(this, message.GetProperty("message").GetString()!); break;
            }
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or FormatException)
        { EditorError?.Invoke(this, "Niepoprawna odpowiedź edytora: " + error.Message); }
    }

    private void ApplySnapshot(JsonElement message)
    {
        if (!Guid.TryParse(message.GetProperty("noteId").GetString(), out var id)) return;
        DocumentChanged?.Invoke(this, new(id, message.GetProperty("documentJson").GetString()!, message.GetProperty("markdown").GetString()!));
    }

    public void OpenNote(Guid id, string markdown, string? documentJson)
    {
        _pendingDocument = new { type = "open", noteId = id.ToString(), markdown, documentJson };
        Send(_pendingDocument);
    }
    public void Clear() { _pendingDocument = new { type = "open", noteId = (string?)null, markdown = "", documentJson = (string?)null }; Send(_pendingDocument); }
    public void CloseNote(Guid id) => Send(new { type = "close", noteId = id.ToString() });
    public void Execute(string action, string? value = null) => Send(new { type = "command", action, value });
    public void UndoContentChange() => Execute("undo");
    public void RedoContentChange() => Execute("redo");
    public void AddPythonCell() => Execute("cell");
    public void SetZoom(int percent) { _zoom = Math.Clamp(percent, 20, 200); SendView(); }
    public new bool Focus() { if (!_ready) return false; _web.Focus(); Send(new { type = "focus" }); return true; }
    private void SendView() => Send(new { type = "view", zoom = _zoom, spacing = _spacing });
    private void Send(object message) { if (_ready && !_disposed) _web.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message)); }

    public async Task FlushAsync()
    {
        if (!_ready) return;
        var id = Guid.NewGuid().ToString(); var completion = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        _flushes[id] = completion;
        Send(new { type = "flush", requestId = id });
        try { await completion.Task.WaitAsync(TimeSpan.FromSeconds(5)); }
        finally { _flushes.Remove(id); }
    }

    private void Fail(string text)
    {
        _ready = false; _status.Text = text; _status.Visibility = Visibility.Visible;
        _readyCompletion.TrySetException(new InvalidOperationException(text));
        foreach (var waiter in _flushes.Values) waiter.TrySetException(new InvalidOperationException(text));
        _flushes.Clear(); EditorError?.Invoke(this, text);
    }
    private void OpenLink(string? value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http" or "mailto")) return;
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); }
        catch (Exception error) { EditorError?.Invoke(this, "Nie udało się otworzyć linku: " + error.Message); }
    }
    public void Dispose() { if (_disposed) return; _disposed = true; _web.Dispose(); }
}
