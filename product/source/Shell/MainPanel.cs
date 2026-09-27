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
        var frame = new ApplicationFrame(this);
        var panel = new StackPanel { Margin = new Thickness(8, 0, 8, 0) };
        var catalog = new ModuleCatalog(Path.Combine(AppContext.BaseDirectory, "Modules"));
        foreach (var entry in catalog.Entries)
        {
            var label = new StackPanel { Orientation = Orientation.Horizontal };
            label.Children.Add(new ModuleIcon(entry.Id) { Margin = new Thickness(0, 0, 10, 0), VerticalAlignment = VerticalAlignment.Center });
            label.Children.Add(new TextBlock { Text = entry.DisplayName, VerticalAlignment = VerticalAlignment.Center });
            var button = new ActionButton { Content = label, HorizontalAlignment = HorizontalAlignment.Left, HorizontalContentAlignment = HorizontalAlignment.Left, MinWidth = 160, Margin = new Thickness(0, 4, 0, 4), ToolTip = entry.IsAvailable ? "Otwórz moduł" : "Moduł nie jest zainstalowany" };
            System.Windows.Automation.AutomationProperties.SetName(button, entry.DisplayName);
            button.Click += (_, _) =>
            {
                if (entry.Implementation is { } module) Open(module);
                else DialogService.Show(this, $"Brakuje modułu „{entry.DisplayName}”. Jego funkcjonalność nie jest jeszcze dostępna.", "Brak modułu", MessageBoxButton.OK, MessageBoxImage.Information);
            };
            panel.Children.Add(button);
        }
        if (catalog.Modules.Count == 0) panel.Children.Add(new TextBlock { Text = "Brak zainstalowanych modułów." });
        foreach (var error in catalog.Errors) panel.Children.Add(new TextBlock { Text = "Nie można załadować modułu: " + error, TextWrapping = TextWrapping.Wrap });
        frame.Sidebar.Content = ApplicationFrame.SidebarLayout(panel, "MODUŁY");
        frame.Workspace.Content = new TextBlock { Text = "Notarium", FontSize = 28, Margin = new Thickness(24) };
        var menu = new MenuBar { FontSize = 12 }; var file = new MenuItem { Header = "_File" }; var exit = new MenuItem { Header = "Zamknij" }; exit.Click += (_, _) => Close(); file.Items.Add(exit); menu.Items.Add(file); frame.Menu.Content = menu;
        Content = frame;
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
