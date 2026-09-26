using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Data;
using Microsoft.Win32;
using System.IO;
using Notarium.UI;

namespace Notatnik;

public sealed class NotebookFormatting
{
    private readonly WebEditorControl Editor;
    private readonly Func<Note?> _active;
    private readonly Action<string> _fontLabel, _spacingLabel;
    private readonly Action<bool, string> _colorLabel;
    private Note? ActiveNote => _active();
    public NotebookFormatting(WebEditorControl editor, Func<Note?> active, Action<string> fontLabel, Action<string> spacingLabel, Action<bool, string> colorLabel)
    { Editor = editor; _active = active; _fontLabel = fontLabel; _spacingLabel = spacingLabel; _colorLabel = colorLabel; }
    private static DropDownMenu CreatePopupMenu(object sender, double? itemWidth = null) => new(sender as UIElement, itemWidth);

    private string _lastTextColor = "#E76F6F";
    private string _lastHighlightColor = "#F4D35E";
    public void MarkdownButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button { Tag: string action }) return;

        if (ActiveNote is null) return;
        switch (action)
        {
            case "fontfamily": ShowFontMenu((Button)sender); return;
            case "linespacing": ShowLineSpacingMenu((Button)sender); return;
            case "contentwidth": ShowContentWidthMenu((Button)sender); return;
            default: Editor.Execute(action); break;
        }
    }

    private void ShowContentWidthMenu(Button source)
    {
        var values = new[] { ("Wąska", 650), ("Standardowa", 790), ("Szeroka", 960), ("Pełna szerokość", 0) };
        var menu = CreatePopupMenu(source, itemWidth: 158);
        foreach (var (name, width) in values)
        {
            var selectedWidth = width;
            var item = new MenuItem
            {
                Header = width == 0 ? name : $"{name} ({width}px)",
                IsCheckable = true,
                IsChecked = Editor.CurrentContentWidth == width,
            };
            item.Click += (_, _) => { Editor.Execute("contentWidth", selectedWidth.ToString()); Editor.Focus(); };
            menu.Items.Add(item);
        }
        menu.IsOpen = true;
    }

    private void ShowFontMenu(Button source)
    {
        var fonts = new[] { "Segoe UI", "Arial", "Calibri", "Georgia", "Times New Roman", "Verdana", "Cascadia Mono", "Consolas" };
        var menu = CreatePopupMenu(source);
        foreach (var font in fonts)
        {
            var item = new MenuItem
            {
                Header = new TextBlock { Text = font, FontFamily = new System.Windows.Media.FontFamily(font), FontSize = 14 },
                Tag = font,
            };
            item.Click += (_, _) =>
            {
                Editor.Execute("font", font);
                _fontLabel($"{font} ▾");
            };
            menu.Items.Add(item);
        }
        menu.IsOpen = true;
    }

    private void ShowLineSpacingMenu(Button source)
    {
        var values = new[] { 1.0d, 1.15d, 1.25d, 1.5d, 2.0d };
        var menu = CreatePopupMenu(source);
        foreach (var value in values)
        {
            var selectedValue = value;
            var label = selectedValue.ToString("0.##", System.Globalization.CultureInfo.GetCultureInfo("pl-PL"));
            var item = new MenuItem
            {
                Header = label,
                IsCheckable = true,
                IsChecked = Math.Abs(Editor.LineSpacingFactor - selectedValue) < 0.001,
            };
            item.Click += (_, _) =>
            {
                Editor.LineSpacingFactor = selectedValue;
                _spacingLabel($"↕ {label}");
                Editor.Focus();
            };
            menu.Items.Add(item);
        }
        menu.IsOpen = true;
    }

    private void ShowColorMenu(Button source, bool highlight)
    {
        var colors = highlight
            ? new[] { ("Żółty", "#F4D35E"), ("Zielony", "#8FD694"), ("Różowy", "#F3A6C8"), ("Niebieski", "#8EC5E8"), ("Fioletowy", "#C9A7E3") }
            : new[] { ("Czerwony", "#E76F6F"), ("Pomarańczowy", "#E99B52"), ("Zielony", "#58B889"), ("Niebieski", "#5B9BD5"), ("Fioletowy", "#A779D1") };

        var menu = CreatePopupMenu(source);
        var clear = new MenuItem
        {
            Header = highlight ? "Bez podświetlenia" : "Domyślny kolor",
        };
        clear.Click += (_, _) => Editor.Execute(highlight ? "clearHighlight" : "clearColor");
        menu.Items.Add(clear);
        menu.Items.Add(new Separator());
        foreach (var (name, hex) in colors)
        {
            var row = new StackPanel { Orientation = Orientation.Horizontal };
            row.Children.Add(new Border
            {
                Width = 14,
                Height = 14,
                CornerRadius = new CornerRadius(2),
                Background = (System.Windows.Media.Brush)new System.Windows.Media.BrushConverter().ConvertFromString(hex)!,
                Margin = new Thickness(0, 0, 8, 0)
            });
            row.Children.Add(new TextBlock { Text = name, VerticalAlignment = VerticalAlignment.Center });
            var item = new MenuItem { Header = row, Tag = hex };
            item.Click += (_, _) =>
            {
                ApplyChosenColor(highlight, hex);
            };
            menu.Items.Add(item);
        }
        menu.Items.Add(new Separator());
        var more = new MenuItem { Header = "Więcej kolorów…" };
        more.Click += (_, _) => ShowRgbColorDialog(highlight);
        menu.Items.Add(more);
        menu.IsOpen = true;
    }

    public void ToggleFontColor_Click(object sender, RoutedEventArgs e) => ToggleColor(highlight: false);
    public void ToggleHighlightColor_Click(object sender, RoutedEventArgs e) => ToggleColor(highlight: true);
    public void FontColorMenu_Click(object sender, RoutedEventArgs e) => ShowColorMenu((Button)sender, highlight: false);
    public void HighlightColorMenu_Click(object sender, RoutedEventArgs e) => ShowColorMenu((Button)sender, highlight: true);

    private void ToggleColor(bool highlight)
    {
        if (ActiveNote is null) return;
        var selected = highlight ? Editor.CurrentHighlightColor : Editor.CurrentTextColor;
        var last = highlight ? _lastHighlightColor : _lastTextColor;
        Editor.Execute(string.Equals(selected, last, StringComparison.OrdinalIgnoreCase)
            ? highlight ? "clearHighlight" : "clearColor"
            : highlight ? "highlight" : "color", string.Equals(selected, last, StringComparison.OrdinalIgnoreCase) ? null : last);
    }

    private void ApplyChosenColor(bool highlight, string hex)
    {
        if (highlight) _lastHighlightColor = hex; else _lastTextColor = hex;
        _colorLabel(highlight, hex);
        Editor.Execute(highlight ? "highlight" : "color", hex);
    }

    private void ShowRgbColorDialog(bool highlight)
    {
        var initial = highlight ? _lastHighlightColor : _lastTextColor;
        if (DialogService.Color(initial) is string hex) ApplyChosenColor(highlight, hex);
    }

    public void AddCodeCell_Click(object sender, RoutedEventArgs e)
    {
        if (ActiveNote is not null) Editor.AddPythonCell();
    }

}
