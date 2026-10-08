using System.Globalization;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Notarium.UI;

namespace Notatnik;

// Native ribbon, immediately below the menu. The web editor owns all data/history.
public sealed class NotebookRibbon : Border
{
    private readonly WebEditorControl _editor;
    private readonly StackPanel _groups = new() { Orientation = Orientation.Horizontal };
    private readonly Dictionary<string, FrameworkElement> _fields = new();
    private readonly Dictionary<string, ActionButton> _tabs = new();
    private readonly TextBlock _error = new() { Foreground = UiPolicy.Brush("#E76F6F"), FontSize = 11 };
    private string _active = "Układ";
    private bool _sync;

    public NotebookRibbon(WebEditorControl editor)
    {
        _editor = editor;
        Background = UiPolicy.Brush("#262626");
        BorderBrush = UiPolicy.Brush("#414141"); BorderThickness = new Thickness(0, 0, 0, 1);
        var root = new StackPanel(); Child = root;
        var header = new WrapPanel { Margin = new Thickness(8, 0, 8, 0) }; root.Children.Add(header);
        foreach (var tab in new[] { "Układ", "Wstawianie", "Odwołania", "Obiekty" })
        {
            var button = Button(tab, () => Select(tab)); _tabs[tab] = button; header.Children.Add(button);
        }
        header.Children.Add(new Border { Width = 1, Height = 16, Background = UiPolicy.Brush("#505050"), Margin = new Thickness(10, 0, 10, 0) });
        foreach (var (label, command) in new[] { ("Panel prawy", "comments"), ("AI", "ai"), ("Math", "math") })
            header.Children.Add(Button(label, () => _editor.Execute("workspacePanel", command)));
        header.Children.Add(Button("Zwiń / rozwiń", () => _groups.Visibility = _groups.Visibility == Visibility.Visible ? Visibility.Collapsed : Visibility.Visible));
        root.Children.Add(new ScrollViewer { Content = _groups, HorizontalScrollBarVisibility = ScrollBarVisibility.Auto, VerticalScrollBarVisibility = ScrollBarVisibility.Disabled });
        root.Children.Add(_error);
        _editor.SelectionChanged += (_, _) => Refresh();
        _editor.RibbonError += (_, message) => _error.Text = message;
        Select("Układ");
    }
    private static ActionButton Button(string label, Action action)
    {
        var button = new ActionButton { Content = label, Height = 28, Padding = new Thickness(9, 2, 9, 2), Foreground = UiPolicy.Current.TextBrush, Focusable = false };
        System.Windows.Automation.AutomationProperties.SetName(button, label);
        button.Click += (_, _) => action(); return button;
    }
    private StackPanel Group(string title)
    {
        var content = new StackPanel { Margin = new Thickness(9, 4, 9, 3) };
        var panel = new StackPanel(); panel.Children.Add(content);
        panel.Children.Add(new TextBlock { Text = title, Foreground = UiPolicy.Brush("#aaaaaa"), FontSize = 10, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 3) });
        _groups.Children.Add(new Border { Child = panel, BorderBrush = UiPolicy.Brush("#505050"), BorderThickness = new Thickness(0, 0, 1, 0) }); return content;
    }
    private void Actions(string title, params (string Label, string Action)[] actions)
    {
        var group = Group(title);
        foreach (var (label, action) in actions) group.Children.Add(Button(label, () => _editor.Execute(action)));
    }
    private void Number(StackPanel group, string key, string label, string unit)
    {
        var row = new StackPanel { Orientation = Orientation.Horizontal };
        row.Children.Add(new TextBlock { Text = label, Width = 86, VerticalAlignment = VerticalAlignment.Center, FontSize = 11 });
        var field = new TextBox { Width = 65, Height = 24, Margin = new Thickness(3, 1, 3, 1), Padding = new Thickness(4, 1, 4, 1), Background = UiPolicy.Brush("#202020"), Foreground = UiPolicy.Current.TextBrush, BorderBrush = UiPolicy.Brush("#555555"), BorderThickness = new Thickness(1) };
        _fields[key] = field; System.Windows.Automation.AutomationProperties.SetName(field, label + " " + unit);
        void Apply()
        {
            if (_sync) return;
            if (!double.TryParse(field.Text.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var value) || !double.IsFinite(value) || value < 0 || value > (key == "width" ? 4000 : key is "before" or "after" ? 1000 : 100))
            { _error.Text = "Nieprawidłowa wartość: " + label; return; }
            _error.Text = ""; Set(key, value);
        }
        field.LostKeyboardFocus += (_, _) => Apply();
        field.KeyDown += (_, e) => { if (e.Key == Key.Enter) { Apply(); e.Handled = true; } };
        row.Children.Add(field); row.Children.Add(new TextBlock { Text = unit, VerticalAlignment = VerticalAlignment.Center, FontSize = 10 }); group.Children.Add(row);
    }
    private void Toggle(StackPanel group, string key, string label)
    {
        var field = new CheckBox { Content = label, Margin = new Thickness(0, 3, 0, 3), FontSize = 11, Foreground = UiPolicy.Current.TextBrush }; _fields[key] = field;
        field.Click += (_, _) => { if (!_sync) Set(key, field.IsChecked == true); }; group.Children.Add(field);
    }
    private void Choice(StackPanel group, string key, params string[] values)
    {
        var field = Button("▾", () => { }); field.Width = 120; field.Height = 25; field.Margin = new Thickness(0, 2, 0, 2); field.Background = UiPolicy.Brush("#303030"); _fields[key] = field;
        System.Windows.Automation.AutomationProperties.SetName(field, key == "size" ? "Rozmiar strony" : "Kolor strony");
        field.Click += (_, _) => {
            var menu = new DropDownMenu(field);
            foreach (var value in values) {
                var item = new MenuItem { Header = ChoiceLabel(value), IsCheckable = true, IsChecked = Equals(field.Tag, value) };
                item.Click += (_, _) => Set(key, value); menu.Items.Add(item);
            }
            menu.IsOpen = true;
        }; group.Children.Add(field);
    }
    private static string ChoiceLabel(string value) => value switch { "#202020" => "Ciemna", "#ffffff" => "Biała", "#fff8e7" => "Kremowa", "#eaf2ff" => "Błękitna", _ => value };
    private void Set(string key, object value) => _editor.Execute("layoutField", JsonSerializer.Serialize(new { key, value }));
    private void Select(string tab)
    {
        _active = tab; _groups.Children.Clear(); _fields.Clear(); _groups.Visibility = Visibility.Visible; _error.Text = "";
        foreach (var (name, button) in _tabs) button.Foreground = name == tab ? UiPolicy.Current.AccentBrush : UiPolicy.Current.TextBrush;
        if (tab == "Układ")
        {
            var page = Group("Obszar i strony"); Toggle(page, "paged", "Podział na strony"); Number(page, "width", "Szerokość", "px"); Choice(page, "size", "A3", "A4", "A5", "Letter", "Legal"); Toggle(page, "landscape", "Poziomo");
            var margins = Group("Marginesy"); foreach (var (key, label) in new[] { ("top", "Góra"), ("bottom", "Dół"), ("left", "Lewo"), ("right", "Prawo") }) Number(margins, key, label, "mm");
            var indent = Group("Wcięcie akapitu"); Number(indent, "indentLeft", "Z lewej", "mm"); Number(indent, "indentRight", "Z prawej", "mm");
            var space = Group("Odstępy akapitu"); Number(space, "before", "Przed", "pt"); Number(space, "after", "Po", "pt"); Toggle(space, "hyphenation", "Dzielenie wyrazów");
            var appearance = Group("Strona"); Choice(appearance, "color", "#202020", "#ffffff", "#fff8e7", "#eaf2ff");
            appearance.Children.Add(Button("Stopka i numeracja", () => _editor.Execute("workspacePanel", "numbering")));
            appearance.Children.Add(Button("Zaawansowany układ…", () => _editor.Execute("pageLayout")));
        }
        else if (tab == "Wstawianie")
        {
            Actions("Tekst", ("Link", "link"), ("Kod w tekście", "code"), ("Kontener", "container"));
            Actions("Obiekty", ("Obraz", "image"), ("Tabela", "table"), ("Wzór LaTeX", "math"));
            Actions("Kod", ("Blok kodu", "codeblock"), ("Komórka Python", "cell"));
        }
        else if (tab == "Odwołania")
        {
            var group = Group("Dokument"); foreach (var (label, panel) in new[] { ("Komentarze", "comments"), ("Numeracje", "numbering"), ("Fragmenty robocze", "snippets") }) group.Children.Add(Button(label, () => _editor.Execute("workspacePanel", panel)));
            Actions("Odnośniki", ("Wstaw link", "link"));
        }
        else
        {
            var group = Group("Właściwości"); group.Children.Add(Button("Ustawienia kontenera", () => _editor.Execute("workspacePanel", "container")));
            group.Children.Add(Button("Ustawienia obrazu", () => _editor.Execute("workspacePanel", "image")));
            Actions("Obiekty", ("Obraz", "image"), ("Tabela", "table"), ("Math", "math"));
            Actions("Wyrównanie", ("Do lewej", "alignLeft"), ("Do środka", "alignCenter"), ("Do prawej", "alignRight"));
        }
        Refresh();
    }
    private void Refresh()
    {
        if (_active != "Układ" || _editor.CurrentLayout is not JsonElement layout) return;
        _sync = true;
        try { foreach (var (key, field) in _fields) if (layout.TryGetProperty(key, out var value))
        {
            // Do not replace a partially entered value while editing another field.
            if (field.IsKeyboardFocusWithin) continue;
            if (field is CheckBox check) check.IsChecked = value.ValueKind == JsonValueKind.True;
            else if (field is TextBox text) text.Text = value.ToString();
            else if (field is ActionButton choice) { choice.Tag = value.ToString(); choice.Content = ChoiceLabel(value.ToString()) + " ▾"; }
        } } finally { _sync = false; }
    }
}
