using System.Globalization;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Controls.Primitives;
using Notarium.UI;

namespace Notatnik;

// Native ribbon with one shared menu/tab row. The web editor owns all data/history.
public sealed class NotebookRibbon : Border
{
    private readonly WebEditorControl _editor;
    private readonly StackPanel _groups = new() { Orientation = Orientation.Horizontal };
    private readonly StackPanel _body = new();
    public bool IsExpanded => _body.Visibility == Visibility.Visible;
    private readonly Dictionary<string, FrameworkElement> _fields = new();
    private readonly Dictionary<string, ActionButton> _tabs = new();
    private readonly Dictionary<string, Border> _tabLines = new();
    private JsonElement? _values;
    private DropDownMenu? _openMenu;
    private readonly TextBlock _error = new() { Foreground = UiPolicy.Brush("#E76F6F"), FontSize = 11 };
    private string _active = "Układ";
    private bool _sync;

    public NotebookRibbon(WebEditorControl editor, MenuBar? mainMenu = null)
    {
        _editor = editor;
        Background = UiPolicy.Brush("#262626");
        BorderBrush = UiPolicy.Brush("#414141"); BorderThickness = new Thickness(0, 0, 0, 1);
        var root = new StackPanel(); Child = root;
        var header = new DockPanel { Margin = new Thickness(8, 0, 8, 0), LastChildFill = true }; root.Children.Add(header);
        if (mainMenu is not null)
        {
            mainMenu.Height = 28; mainMenu.Background = System.Windows.Media.Brushes.Transparent;
            DockPanel.SetDock(mainMenu, Dock.Left); header.Children.Add(mainMenu);
        }
        var shortcuts = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
        DockPanel.SetDock(shortcuts, Dock.Right); header.Children.Add(shortcuts);
        foreach (var (label, icon, command) in new[] { ("Panel prawy", "panel", "comments"), ("AI", "ai", "ai"), ("Math", "math", "math") })
            shortcuts.Children.Add(SmallTool(label, icon, () => _editor.Execute("workspacePanel", command)));
        var tabs = new StackPanel { Orientation = Orientation.Horizontal }; header.Children.Add(tabs);
        foreach (var tab in new[] { "Układ", "Wstawianie", "Odwołania", "Obiekty" })
        {
            var button = Button(tab, () => ActivateTab(tab)); button.FontSize = 12; _tabs[tab] = button;
            var label = new StackPanel(); label.Children.Add(new TextBlock { Text = tab, Margin = new Thickness(0, 1, 0, 4) });
            var line = new Border { Height = 2, Background = System.Windows.Media.Brushes.Transparent }; label.Children.Add(line); _tabLines[tab] = line;
            button.Content = label; tabs.Children.Add(button);
        }
        root.Children.Add(_body);
        _body.Children.Add(new ScrollViewer { Content = _groups, HorizontalScrollBarVisibility = ScrollBarVisibility.Auto, VerticalScrollBarVisibility = ScrollBarVisibility.Disabled });
        _body.Children.Add(_error);
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
    private StackPanel Group(string title, bool horizontal = true)
    {
        var content = new StackPanel { Orientation = horizontal ? Orientation.Horizontal : Orientation.Vertical, Height = 76, Margin = new Thickness(6, 4, 6, 2), VerticalAlignment = VerticalAlignment.Top };
        var panel = new StackPanel(); panel.Children.Add(content);
        panel.Children.Add(new TextBlock { Text = title, Foreground = UiPolicy.Brush("#aaaaaa"), FontSize = 10, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 3) });
        _groups.Children.Add(new Border { Child = panel, BorderBrush = UiPolicy.Brush("#505050"), BorderThickness = new Thickness(0, 0, 1, 0) }); return content;
    }
    private ActionButton Tool(string label, string icon, Action action, bool dropdown = false)
    {
        var content = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        content.Children.Add(RibbonIcon.Create(icon));
        content.Children.Add(new TextBlock { Text = label, FontSize = 11, TextAlignment = TextAlignment.Center, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 4, 0, 0) });
        if (dropdown) content.Children.Add(new TextBlock { Text = "⌄", FontSize = 10, HorizontalAlignment = HorizontalAlignment.Center });
        var button = Button(label, action); button.Content = content; button.Width = 74; button.Height = 74; button.Padding = new Thickness(5, 3, 5, 3); button.ToolTip = label;
        button.Tag = "ribbon-large-tool"; return button;
    }
    private ActionButton SmallTool(string label, string icon, Action action, bool dropdown = false)
    {
        var content = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
        content.Children.Add(RibbonIcon.Create(icon, 17));
        content.Children.Add(new TextBlock { Text = label + (dropdown ? "  ⌄" : ""), FontSize = 11, Margin = new Thickness(5, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center });
        var button = Button(label, action); button.Content = content; button.Height = 25; button.Padding = new Thickness(5, 2, 5, 2); button.ToolTip = label; return button;
    }
    private void Number(StackPanel group, string key, string label, string unit)
    {
        var row = new StackPanel { Orientation = Orientation.Horizontal };
        row.Children.Add(RibbonIcon.Create(key == "indentLeft" ? "indentLeft" : key == "indentRight" ? "indentRight" : "spacing", 17));
        row.Children.Add(new TextBlock { Text = label, Width = 51, Margin = new Thickness(4, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center, FontSize = 11 });
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
    private bool Is(string key, object value) => _values is JsonElement layout && layout.TryGetProperty(key, out var current) && current.ToString().Equals(Convert.ToString(value, CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase);
    private void Menu(ActionButton anchor, Action<DropDownMenu> populate)
    {
        _openMenu?.Close(); var menu = _openMenu = new DropDownMenu(anchor, itemWidth: 280); populate(menu); menu.IsOpen = true;
    }
    private static MenuItem Item(string label, string icon, Action action, bool? selected = null, string? detail = null)
    {
        var header = new StackPanel { Orientation = Orientation.Horizontal };
        header.Children.Add(RibbonIcon.Create(icon, detail is null ? 20 : 31));
        var text = new StackPanel { Margin = new Thickness(8, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
        text.Children.Add(new TextBlock { Text = label, FontSize = 12 });
        if (detail is not null) text.Children.Add(new TextBlock { Text = detail, FontSize = 10, MaxWidth = 205, TextWrapping = TextWrapping.Wrap, Foreground = UiPolicy.Brush("#aaaaaa"), Margin = new Thickness(0, 3, 0, 0) });
        header.Children.Add(text); System.Windows.Automation.AutomationProperties.SetName(header, label);
        var item = new MenuItem { Header = header, IsCheckable = selected.HasValue, IsChecked = selected == true };
        item.Click += (_, _) => action(); return item;
    }
    private void AddDropdown(StackPanel group, string label, string icon, Action<DropDownMenu> populate, bool small = false)
    {
        ActionButton? button = null;
        button = small ? SmallTool(label, icon, () => Menu(button!, populate), true) : Tool(label, icon, () => Menu(button!, populate), true);
        group.Children.Add(button);
    }
    private void Panel(StackPanel group, string label, string icon, string panel, bool small = false) => group.Children.Add(small
        ? SmallTool(label, icon, () => _editor.Execute("workspacePanel", panel))
        : Tool(label, icon, () => _editor.Execute("workspacePanel", panel)));
    private void Command(StackPanel group, string label, string icon, string command, bool small = false) => group.Children.Add(small
        ? SmallTool(label, icon, () => _editor.Execute(command)) : Tool(label, icon, () => _editor.Execute(command)));
    private void Set(string key, object value) => _editor.Execute("layoutField", JsonSerializer.Serialize(new { key, value }));
    private void SetFields(object values) => _editor.Execute("layoutFields", JsonSerializer.Serialize(values));
    private void MarginsMenu(DropDownMenu menu)
    {
        foreach (var (label, top, bottom, left, right) in new[] {
            ("Standardowe", 20d, 20d, 20d, 20d), ("Wąskie", 12.7, 12.7, 12.7, 12.7),
            ("Umiarkowane", 25.4, 25.4, 19.05, 19.05), ("Szerokie", 25.4, 25.4, 40d, 40d) })
        {
            var detail = $"Góra/dół: {top:0.##} mm · Lewo/prawo: {left:0.##} mm";
            var item = Item(label, "margins", () => SetFields(new { top, bottom, left, right }), Is("top", top) && Is("bottom", bottom) && Is("left", left) && Is("right", right), detail);
            var header = (StackPanel)item.Header; header.Children.RemoveAt(0);
            var preview = new Grid { Width = 31, Height = 38 };
            preview.Children.Add(new Border { BorderBrush = UiPolicy.Current.AccentBrush, BorderThickness = new Thickness(1), Margin = new Thickness(2, 0, 2, 0) });
            preview.Children.Add(new Border { BorderBrush = UiPolicy.Current.AccentBrush, BorderThickness = new Thickness(1), Margin = new Thickness(2 + left / 8, top / 8, 2 + right / 8, bottom / 8) });
            header.Children.Insert(0, preview); menu.Items.Add(item);
        }
        menu.Items.Add(new Separator());
        foreach (var (key, label) in new[] { ("top", "Górny margines"), ("bottom", "Dolny margines"), ("left", "Lewy margines"), ("right", "Prawy margines") })
        {
            var parent = Item(label, "margins", () => { });
            foreach (var value in new[] { 5d, 10d, 15d, 20d, 25.4, 30d, 40d }) parent.Items.Add(Item($"{value:0.##} mm", "margins", () => Set(key, value), Is(key, value)));
            menu.Items.Add(parent);
        }
        menu.Items.Add(new Separator()); menu.Items.Add(Item("Marginesy niestandardowe…", "settings", () => _editor.Execute("pageLayout")));
    }
    private void AreaMenu(DropDownMenu menu)
    {
        menu.Items.Add(Item("Obszar ciągły", "width", () => Set("paged", false), Is("paged", false), "Notatka bez podziału na strony"));
        menu.Items.Add(Item("Podział na strony", "page", () => Set("paged", true), Is("paged", true), "Automatyczny przepływ treści"));
        menu.Items.Add(new Separator());
        foreach (var (label, width) in new[] { ("Wąski", 650), ("Standardowy", 790), ("Szeroki", 960), ("Pełna szerokość", 0) })
            menu.Items.Add(Item(label, "width", () => Set("width", width), Is("width", width), width == 0 ? "Dopasuj do okna" : width + " px"));
        menu.Items.Add(new Separator());
        var row = new StackPanel(); row.Children.Add(new TextBlock { Text = "Własna szerokość (px)", FontSize = 11 });
        var controls = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 5, 0, 0) };
        var input = new TextBox { Text = _values?.GetProperty("width").ToString() ?? "0", Width = 100, Height = 25, Padding = new Thickness(4, 1, 4, 1), Background = UiPolicy.Brush("#202020"), Foreground = UiPolicy.Current.TextBrush, BorderBrush = UiPolicy.Brush("#555555") };
        System.Windows.Automation.AutomationProperties.SetName(input, "Własna szerokość px"); controls.Children.Add(input);
        var apply = Button("Zastosuj", () => { }); apply.Height = 25; controls.Children.Add(apply); row.Children.Add(controls);
        void Commit() {
            if (int.TryParse(input.Text, out var value) && value >= 0 && value <= 4000) { menu.Close(); Set("width", value); }
            else _error.Text = "Szerokość musi być liczbą od 0 do 4000 px.";
        }
        apply.Click += (_, e) => { e.Handled = true; Commit(); };
        input.KeyDown += (_, e) => { if (e.Key == Key.Enter) { e.Handled = true; Commit(); } };
        menu.Items.Add(new MenuItem { Header = row });
    }
    private void ColorMenu(DropDownMenu menu)
    {
        foreach (var (label, color) in new[] { ("Ciemna", "#202020"), ("Biała", "#ffffff"), ("Kremowa", "#fff8e7"), ("Błękitna", "#eaf2ff") })
        {
            var item = Item(label, "color", () => Set("color", color), Is("color", color));
            var header = (StackPanel)item.Header; header.Children.RemoveAt(0);
            header.Children.Insert(0, new Border { Width = 22, Height = 22, CornerRadius = new CornerRadius(2), Background = UiPolicy.Brush(color), BorderBrush = UiPolicy.Brush("#888888"), BorderThickness = new Thickness(1) });
            menu.Items.Add(item);
        }
        menu.Items.Add(new Separator());
        menu.Items.Add(Item("Więcej kolorów…", "color", () => { if (DialogService.Color(_values?.GetProperty("color").GetString() ?? "#202020") is string color) Set("color", color); }));
    }
    private void ImagesMenu(DropDownMenu menu)
    {
        menu.Items.Add(Item("Obraz z pliku…", "image", () => _editor.Execute("image"), detail: "PNG, JPEG, WebP, GIF lub BMP"));
        menu.Items.Add(new Separator());
        menu.Items.Add(Item("Właściwości wybranego obrazu", "settings", () => _editor.Execute("workspacePanel", "image")));
    }
    private void MathMenu(DropDownMenu menu)
    {
        menu.Items.Add(Item("Równanie w tekście", "math", () => _editor.Execute("math"), detail: "Wstaw wzór LaTeX w bieżącej linii"));
        menu.Items.Add(Item("Równanie w osobnym wierszu", "math", () => _editor.Execute("mathBlock"), detail: "Wzór blokowy z opcjonalną numeracją"));
    }
    private void TableMenu(DropDownMenu menu)
    {
        var preview = new StackPanel(); var label = new TextBlock { Text = "Wstaw tabelę", FontSize = 12, Margin = new Thickness(0, 0, 0, 6) }; preview.Children.Add(label);
        var grid = new UniformGrid { Rows = 8, Columns = 10, Width = 210, Height = 168 }; preview.Children.Add(grid);
        var cells = new List<Border>();
        for (var row = 1; row <= 8; row++) for (var col = 1; col <= 10; col++)
        {
            var r = row; var c = col;
            var box = new Border { Width = 18, Height = 18, BorderBrush = UiPolicy.Brush("#777777"), BorderThickness = new Thickness(1), Background = System.Windows.Media.Brushes.Transparent };
            cells.Add(box);
            var button = new ActionButton { Content = box, Padding = new Thickness(1), HorizontalContentAlignment = HorizontalAlignment.Center, VerticalContentAlignment = VerticalAlignment.Center, Focusable = true, ToolTip = $"{c} kolumn × {r} wierszy" };
            System.Windows.Automation.AutomationProperties.SetName(button, $"Tabela {c} kolumn {r} wierszy");
            button.MouseEnter += (_, _) => {
                label.Text = $"Tabela {c} × {r}";
                for (var i = 0; i < cells.Count; i++) cells[i].Background = i / 10 < r && i % 10 < c ? UiPolicy.Brush("#31547a") : System.Windows.Media.Brushes.Transparent;
            };
            button.Click += (_, e) => { e.Handled = true; menu.Close(); _editor.Execute("tableSize", JsonSerializer.Serialize(new { rows = r, cols = c })); };
            grid.Children.Add(button);
        }
        menu.Items.Add(new MenuItem { Header = preview }); menu.Items.Add(new Separator());
        menu.Items.Add(Item("Wstaw / edytuj tabelę…", "table", () => _editor.Execute("table"), detail: "Rozmiar, wiersze, kolumny i scalanie komórek"));
    }
    private void Select(string tab)
    {
        _openMenu?.Close();
        _active = tab; _groups.Children.Clear(); _fields.Clear(); _body.Visibility = Visibility.Visible; _error.Text = "";
        foreach (var (name, button) in _tabs) { button.Foreground = UiPolicy.Current.TextBrush; _tabLines[name].Background = name == tab ? UiPolicy.Current.AccentBrush : System.Windows.Media.Brushes.Transparent; }
        if (tab == "Układ")
        {
            var page = Group("Ustawienia strony");
            AddDropdown(page, "Marginesy", "margins", MarginsMenu);
            AddDropdown(page, "Orientacja", "orientation", menu => {
                menu.Items.Add(Item("Pionowa", "page", () => Set("landscape", false), Is("landscape", false)));
                menu.Items.Add(Item("Pozioma", "orientation", () => Set("landscape", true), Is("landscape", true)));
            });
            AddDropdown(page, "Rozmiar", "size", menu => {
                foreach (var (size, dimensions) in new[] { ("A3", "297 × 420 mm"), ("A4", "210 × 297 mm"), ("A5", "148 × 210 mm"), ("Letter", "215,9 × 279,4 mm"), ("Legal", "215,9 × 355,6 mm") })
                    menu.Items.Add(Item(size, "size", () => Set("size", size), Is("size", size), dimensions));
            });
            AddDropdown(page, "Obszar", "width", AreaMenu);
            var text = Group("Tekst", false);
            AddDropdown(text, "Dzielenie wyrazów", "hyphen", menu => {
                menu.Items.Add(Item("Bez dzielenia", "hyphen", () => Set("hyphenation", false), Is("hyphenation", false)));
                menu.Items.Add(Item("Automatyczne (polski)", "hyphen", () => Set("hyphenation", true), Is("hyphenation", true)));
            }, true);
            Panel(text, "Stopka i numeracje", "numbering", "numbering", true);
            Command(text, "Zaawansowany układ…", "settings", "pageLayout", true);
            var indent = Group("Wcięcie", false); Number(indent, "indentLeft", "Z lewej", "mm"); Number(indent, "indentRight", "Z prawej", "mm");
            var space = Group("Odstępy", false); Number(space, "before", "Przed", "pt"); Number(space, "after", "Po", "pt");
            AddDropdown(Group("Tło strony"), "Kolor strony", "color", ColorMenu);
        }
        else if (tab == "Wstawianie")
        {
            Command(Group("Kontenery"), "Kontener", "container", "container");
            AddDropdown(Group("Tabele"), "Tabela", "table", TableMenu);
            AddDropdown(Group("Ilustracje"), "Obrazy", "image", ImagesMenu);
            var text = Group("Tekst", false); Command(text, "Link", "link", "link", true); Command(text, "Kod w tekście", "code", "code", true);
            var code = Group("Kod"); Command(code, "Blok kodu", "code", "codeblock"); Command(code, "Komórka Python", "cell", "cell");
            AddDropdown(Group("Symbole"), "Równanie", "math", MathMenu);
        }
        else if (tab == "Odwołania")
        {
            Panel(Group("Komentarze"), "Komentarze", "comments", "comments");
            Panel(Group("Nagłówek i stopka"), "Numeracje", "numbering", "numbering");
            Command(Group("Odnośniki"), "Link", "link", "link");
            Panel(Group("Fragmenty"), "Fragmenty robocze", "snippets", "snippets");
        }
        else
        {
            var properties = Group("Właściwości"); Panel(properties, "Kontener", "container", "container"); Panel(properties, "Obraz", "image", "image");
            AddDropdown(Group("Rozmieszczanie"), "Wyrównaj", "alignLeft", menu => {
                foreach (var (label, icon, command) in new[] { ("Wyrównaj do lewej", "alignLeft", "alignLeft"), ("Wyrównaj do środka", "alignCenter", "alignCenter"), ("Wyrównaj do prawej", "alignRight", "alignRight") }) menu.Items.Add(Item(label, icon, () => _editor.Execute(command)));
            });
            AddDropdown(Group("Tabela"), "Tabela", "table", TableMenu);
            AddDropdown(Group("Wzory"), "Równanie", "math", MathMenu);
        }
        Refresh();
    }
    private void ActivateTab(string tab)
    {
        _openMenu?.Close();
        if (_active != tab) { Select(tab); return; }
        _body.Visibility = IsExpanded ? Visibility.Collapsed : Visibility.Visible;
        if (IsExpanded) Refresh();
    }
    private void Refresh()
    {
        _values = _editor.CurrentLayout;
        if (_active != "Układ" || _values is not JsonElement layout) return;
        _sync = true;
        try { foreach (var (key, field) in _fields) if (layout.TryGetProperty(key, out var value))
        {
            // Do not replace a partially entered value while editing another field.
            if (field.IsKeyboardFocusWithin) continue;
            if (field is CheckBox check) check.IsChecked = value.ValueKind == JsonValueKind.True;
            else if (field is TextBox text) text.Text = value.ToString();
        } } finally { _sync = false; }
    }
}
