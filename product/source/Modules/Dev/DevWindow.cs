using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Notarium.UI;
namespace Notarium.Dev;

public sealed class DevWindow : Window
{
    public DevWebGallery WebGallery { get; } = new();
    public StackPanel Samples { get; } = new() { Margin = new Thickness(20) };
    private readonly TextBlock _result = new() { Text = "Wybierz kontrolkę, aby sprawdzić jej zachowanie.", TextWrapping = TextWrapping.Wrap };
    private bool _checked;
    public DevWindow()
    {
        Title = "Notarium — DEV tests"; Width = 1050; Height = 800; MinWidth = 650; MinHeight = 450;
        Background = UiPolicy.Brush(UiPolicy.Current.MenuBackground); Foreground = Brushes.White;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        var tabs = new TabControl { Margin = new Thickness(12) };
        tabs.Items.Add(new TabItem { Header = "Windows · WPF", Content = new ScrollViewer { Content = Samples, VerticalScrollBarVisibility = ScrollBarVisibility.Auto } });
        tabs.Items.Add(new TabItem { Header = "Edytor · Web", Content = WebGallery });
        Content = tabs;
        AddTitle("Wspólne komponenty Windows", "To rzeczywiste klasy z Shared/UI, nie kopie ich wyglądu. Przykłady nie zmieniają danych notatek.");
        var buttons = new WrapPanel();
        buttons.Children.Add(Button("ActionButton", () => _result.Text = "ActionButton: kliknięcie działa."));
        buttons.Children.Add(new ActionButton { Content = "Przycisk wyłączony", IsEnabled = false });
        AddSection("ActionButton — przycisk", buttons);
        var dropdown = Button("Otwórz dropdown", () => { });
        dropdown.Click += (_, _) => Menu(dropdown).IsOpen = true;
        AddSection("DropDownMenu — zwykła, zaznaczana i wyłączona pozycja", dropdown);
        var menuBar = new MenuBar { FontSize = 14 };
        foreach (var title in new[] { "_File", "_View", "_Help" })
        {
            var definition = new MenuItem { Header = title };
            var item = new MenuItem { Header = "Przykładowa akcja" };
            item.Click += (_, _) => _result.Text = title.Replace("_", "") + ": akcja wykonana.";
            definition.Items.Add(item); menuBar.Items.Add(definition);
        }
        AddSection("MenuBar — dropdown pod przyciskiem", menuBar);
        var context = new TextBlock { Text = "Kliknij tutaj prawym przyciskiem myszy.", Padding = new Thickness(12), Background = UiPolicy.Brush(UiPolicy.Current.MenuHover) };
        context.MouseRightButtonUp += (_, e) => { Menu(null).IsOpen = true; e.Handled = true; };
        AddSection("DropDownMenu — menu kontekstowe", context);
        var panel = new ToolPanel { Padding = new Thickness(10), BorderThickness = new Thickness(1), BorderBrush = UiPolicy.Brush(UiPolicy.Current.MenuBorder), Child = Button("Akcja w ToolPanel", () => _result.Text = "ToolPanel: akcja działa.") };
        AddSection("ToolPanel — panel narzędzi", panel);
        var card = new TabCard { Background = UiPolicy.Brush(UiPolicy.Current.MenuSelected), Margin = new Thickness(2) };
        card.Children.Add(new TextBlock { Text = "TabCard — powierzchnia karty", Padding = new Thickness(12) });
        AddSection("TabCard — karta", card);
        var composite = new DemoComposite(); composite.Action += (name, _, _) => _result.Text = "CompositePanel: zdarzenie „" + name + "”.";
        AddSection("CompositePanel — widok emitujący zdarzenia", composite);
        var dialogs = new WrapPanel();
        dialogs.Children.Add(Button("Komunikat", () => DialogService.Show(this, "Przykładowy komunikat DEV.", "DialogService")));
        dialogs.Children.Add(Button("Wybór pliku", () => { var picker = DialogService.OpenFile("DEV — wybór pliku", "Wszystkie pliki|*.*"); _result.Text = picker.ShowDialog(this) == true ? "Wybrano: " + picker.FileName + " (plik nie został otwarty ani zmieniony)." : "Anulowano wybór pliku."; }));
        dialogs.Children.Add(Button("Okno zapisu", () => { var picker = DialogService.SaveFile("DEV — podgląd okna zapisu", "Pliki tekstowe|*.txt", "dev-example.txt", ".txt"); _result.Text = picker.ShowDialog(this) == true ? "Wybrano ścieżkę: " + picker.FileName + " (galeria nic nie zapisuje)." : "Anulowano okno zapisu."; }));
        dialogs.Children.Add(Button("Kolor", () => _result.Text = "Kolor: " + (DialogService.Color("#60A5FA") ?? "anulowano")));
        AddSection("DialogService — systemowe okna", dialogs);
        AddSection("Wynik ostatniej akcji", _result);
        Closed += (_, _) => WebGallery.Dispose();
    }
    private DropDownMenu Menu(UIElement? target)
    {
        var menu = new DropDownMenu(target);
        var normal = new MenuItem { Header = "Zwykła akcja" }; normal.Click += (_, _) => _result.Text = "Dropdown: zwykła akcja.";
        var toggle = new MenuItem { Header = "Opcja on/off", IsCheckable = true, IsChecked = _checked }; toggle.Click += (_, _) => { _checked = toggle.IsChecked; _result.Text = "Dropdown: on/off = " + _checked; };
        menu.Items.Add(normal); menu.Items.Add(toggle); menu.Items.Add(new Separator()); menu.Items.Add(new MenuItem { Header = "Opcja wyłączona", IsEnabled = false }); return menu;
    }
    private static ActionButton Button(string label, Action action)
    { var button = new ActionButton { Content = label, Margin = new Thickness(0, 0, 8, 4) }; button.Click += (_, _) => action(); return button; }
    private void AddTitle(string title, string text)
    { Samples.Children.Add(new TextBlock { Text = title, FontSize = 24 }); Samples.Children.Add(new TextBlock { Text = text, Margin = new Thickness(0, 8, 0, 12), TextWrapping = TextWrapping.Wrap }); }
    private void AddSection(string title, UIElement content)
    { Samples.Children.Add(new TextBlock { Text = title, FontSize = 16, Margin = new Thickness(0, 16, 0, 8) }); Samples.Children.Add(content); }
    private sealed class DemoComposite : CompositePanel
    { public DemoComposite() { Content = Button("Wyślij zdarzenie", () => Emit("demo", this, new RoutedEventArgs())); } }
}
