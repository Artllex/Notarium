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
    private readonly ModuleCatalog _catalog;
    public MainPanel()
    {
        Title = "Notarium"; Width = 900; Height = 600; MinWidth = 500; MinHeight = 300;
        Background = new SolidColorBrush(Color.FromRgb(30, 30, 30)); Foreground = Brushes.White;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        var frame = new ApplicationFrame(this);
        var panel = new StackPanel { Margin = new Thickness(8, 0, 8, 0) };
        var catalog = _catalog = new ModuleCatalog(Path.Combine(AppContext.BaseDirectory, "Modules"));
        foreach (var entry in catalog.Entries)
        {
            var label = new Grid();
            label.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(30) });
            label.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            label.Children.Add(new ModuleIcon(entry.Id) { VerticalAlignment = VerticalAlignment.Center });
            var moduleName = new TextBlock { Text = entry.DisplayName, VerticalAlignment = VerticalAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis, TextWrapping = TextWrapping.NoWrap };
            Grid.SetColumn(moduleName, 1); label.Children.Add(moduleName);
            var button = new ActionButton { Content = label, HorizontalContentAlignment = HorizontalAlignment.Stretch, Margin = new Thickness(0, 4, 0, 4), ToolTip = entry.IsAvailable ? "Otwórz moduł" : "Moduł nie jest zainstalowany" };
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
        frame.Sidebar.Content = ApplicationFrame.SidebarLayout(panel, null, frame.ToggleSidebar);
        frame.Workspace.Content = new TextBlock { Text = "Notarium", FontSize = 28, Margin = new Thickness(24) };
        var menu = new MenuBar { FontSize = 12 };
        var file = new MenuItem { Header = "_File" };
        file.Items.Add(new MenuItem { Header = "Open file...", InputGestureText = "Ctrl+O", IsEnabled = false });
        file.Items.Add(new MenuItem { Header = "Save active note as...", InputGestureText = "Ctrl+S", IsEnabled = false });
        file.Items.Add(new Separator());
        file.Items.Add(new MenuItem { Header = "Delete note", IsEnabled = false });
        file.Items.Add(new Separator());
        var exit = new MenuItem { Header = "Exit" }; exit.Click += (_, _) => Close(); file.Items.Add(exit); menu.Items.Add(file);
        var edit = new MenuItem { Header = "_Edit" };
        edit.Items.Add(new MenuItem { Header = "Undo", InputGestureText = "Ctrl+Z", IsEnabled = false });
        edit.Items.Add(new MenuItem { Header = "Redo", InputGestureText = "Ctrl+Y", IsEnabled = false });
        menu.Items.Add(edit);
        var view = new MenuItem { Header = "_View" };
        view.Items.Add(new MenuItem { Header = "Always highlight container borders", IsEnabled = false }); menu.Items.Add(view);
        var help = new MenuItem { Header = "_Help" };
        var about = new MenuItem { Header = "About Notarium" }; about.Click += (_, _) => DialogService.Show(this, "Notarium", "Notarium", MessageBoxButton.OK, MessageBoxImage.Information);
        help.Items.Add(about); menu.Items.Add(help);
        ConfigureMenu(menu);
        frame.Menu.Content = menu;
        Content = frame;
    }
    private void Open(INotariumModule module)
    {
        if (_windows.TryGetValue(module.Id, out var existing)) { existing.Activate(); return; }
        try
        {
            var window = module.CreateWindow();
            if (window.Content is ApplicationFrame frame && frame.Menu.Content is MenuBar menu) ConfigureMenu(menu);
            _windows.Add(module.Id, window);
            window.Closed += (_, _) => _windows.Remove(module.Id);
            window.Show();
        }
        catch (Exception error) { DialogService.Show(this, error.Message, "Nie można otworzyć modułu", MessageBoxButton.OK, MessageBoxImage.Error); }
    }
    private void ConfigureMenu(MenuBar menu)
    {
        var file = menu.Items.OfType<MenuItem>().First(item => item.Header?.ToString() == "_File");
        var newMenu = new MenuItem { Header = "Nowy" };
        foreach (var entry in _catalog.Entries)
        {
            var item = new MenuItem { Header = entry.DisplayName, IsEnabled = entry.IsAvailable && entry.Id == "notebook" };
            if (entry.Id == "notebook") item.InputGestureText = "Ctrl+N";
            item.Click += (_, _) =>
            {
                if (entry.Implementation is not { } module) return;
                Open(module);
                if (_windows.TryGetValue(entry.Id, out var window) && window is INewItemWindow creator) creator.CreateNewItem();
            };
            newMenu.Items.Add(item);
        }
        if (file.Items.Count > 0 && file.Items[0] is MenuItem first && first.Header?.ToString()?.Contains("New note") == true) file.Items.RemoveAt(0);
        file.Items.Insert(0, newMenu);
        file.Items.Insert(1, new Separator());
        var modules = new MenuItem { Header = "_Moduły" };
        foreach (var entry in _catalog.Entries)
        {
            var item = new MenuItem { Header = entry.DisplayName, IsEnabled = entry.IsAvailable };
            item.Click += (_, _) => { if (entry.Implementation is { } module) Open(module); };
            modules.Items.Add(item);
        }
        menu.Items.Insert(Math.Max(0, menu.Items.Count - 1), modules);
    }
}
