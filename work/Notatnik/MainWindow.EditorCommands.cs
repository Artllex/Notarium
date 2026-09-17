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

namespace Notatnik;

public partial class MainWindow
{
    private string _lastTextColor = "#E76F6F";
    private string _lastHighlightColor = "#F4D35E";
    private void MarkdownButton_Click(object sender, RoutedEventArgs e)
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
                Style = PopupMenuItemStyle()
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
                Style = PopupMenuItemStyle()
            };
            item.Click += (_, _) =>
            {
                Editor.Execute("font", font);
                FontFamilyButton.Content = $"{font} ▾";
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
                Style = PopupMenuItemStyle()
            };
            item.Click += (_, _) =>
            {
                Editor.LineSpacingFactor = selectedValue;
                LineSpacingButton.Content = $"↕ {label}";
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
            Style = PopupMenuItemStyle()
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
            var item = new MenuItem { Header = row, Tag = hex, Style = PopupMenuItemStyle() };
            item.Click += (_, _) =>
            {
                ApplyChosenColor(highlight, hex);
            };
            menu.Items.Add(item);
        }
        menu.Items.Add(new Separator());
        var more = new MenuItem { Header = "Więcej kolorów…", Style = PopupMenuItemStyle() };
        more.Click += (_, _) => ShowRgbColorDialog(highlight);
        menu.Items.Add(more);
        menu.IsOpen = true;
    }

    private void ToggleFontColor_Click(object sender, RoutedEventArgs e) => ToggleColor(highlight: false);
    private void ToggleHighlightColor_Click(object sender, RoutedEventArgs e) => ToggleColor(highlight: true);
    private void FontColorMenu_Click(object sender, RoutedEventArgs e) => ShowColorMenu((Button)sender, highlight: false);
    private void HighlightColorMenu_Click(object sender, RoutedEventArgs e) => ShowColorMenu((Button)sender, highlight: true);

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
        var brush = (System.Windows.Media.Brush)new System.Windows.Media.BrushConverter().ConvertFromString(hex)!;
        if (highlight) HighlightColorSwatch.Background = brush; else FontColorSwatch.Background = brush;
        Editor.Execute(highlight ? "highlight" : "color", hex);
    }

    private void ShowRgbColorDialog(bool highlight)
    {
        var initial = highlight ? _lastHighlightColor : _lastTextColor;
        using var picker = new System.Windows.Forms.ColorDialog
        {
            AllowFullOpen = true,
            FullOpen = true,
            AnyColor = true,
            SolidColorOnly = false,
            Color = System.Drawing.ColorTranslator.FromHtml(initial)
        };
        if (picker.ShowDialog() != System.Windows.Forms.DialogResult.OK) return;
        ApplyChosenColor(highlight, $"#{picker.Color.R:X2}{picker.Color.G:X2}{picker.Color.B:X2}");
    }

    private void AddCodeCell_Click(object sender, RoutedEventArgs e)
    {
        if (ActiveNote is not null) Editor.AddPythonCell();
    }

}
