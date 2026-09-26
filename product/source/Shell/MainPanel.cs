using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Notarium.Contracts;
using Notarium.UI;
namespace Notarium.Shell;

public sealed class MainPanel : Window
{
    private readonly Dictionary<string, Window> _windows = new();
    public MainPanel()
    {
        Title = "Notarium"; Width = 900; Height = 600; MinWidth = 500; MinHeight = 300;
        Background = new SolidColorBrush(Color.FromRgb(30, 30, 30)); Foreground = Brushes.White;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        var panel = new StackPanel { Margin = new Thickness(24) };
        panel.Children.Add(new TextBlock { Text = "Notarium", FontSize = 28, Margin = new Thickness(0, 0, 0, 20) });
        var catalog = new ModuleCatalog(Path.Combine(AppContext.BaseDirectory, "Modules"));
        foreach (var entry in catalog.Entries)
        {
            var button = new ActionButton { Content = entry.DisplayName, HorizontalAlignment = HorizontalAlignment.Left, MinWidth = 160, Margin = new Thickness(0, 4, 0, 4), ToolTip = entry.IsAvailable ? "Otwórz moduł" : "Moduł nie jest zainstalowany" };
            button.Click += (_, _) =>
            {
                if (entry.Implementation is { } module) Open(module);
                else DialogService.Show(this, $"Brakuje modułu „{entry.DisplayName}”. Jego funkcjonalność nie jest jeszcze dostępna.", "Brak modułu", MessageBoxButton.OK, MessageBoxImage.Information);
            };
            panel.Children.Add(button);
        }
        if (catalog.Modules.Count == 0) panel.Children.Add(new TextBlock { Text = "Brak zainstalowanych modułów." });
        foreach (var error in catalog.Errors) panel.Children.Add(new TextBlock { Text = "Nie można załadować modułu: " + error, TextWrapping = TextWrapping.Wrap });
        Content = panel;
    }
    private void Open(INotariumModule module)
    {
        if (_windows.TryGetValue(module.Id, out var existing)) { existing.Activate(); return; }
        try
        {
            var window = module.CreateWindow();
            _windows.Add(module.Id, window);
            window.Closed += (_, _) => _windows.Remove(module.Id);
            window.Show();
        }
        catch (Exception error) { DialogService.Show(this, error.Message, "Nie można otworzyć modułu", MessageBoxButton.OK, MessageBoxImage.Error); }
    }
}
