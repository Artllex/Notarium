using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
namespace Notarium.UI;

// The production recipe is also the DEV sample; no duplicated font menu.
public static class FontPicker
{
    public static readonly string[] Fonts = { "Segoe UI", "Arial", "Calibri", "Georgia", "Times New Roman", "Verdana", "Cascadia Mono", "Consolas" };
    public static DropDownMenu Create(UIElement anchor, Action<string> choose)
    {
        var menu = new DropDownMenu(anchor);
        foreach (var font in Fonts)
        {
            var item = new MenuItem { Header = new TextBlock { Text = font, FontFamily = new FontFamily(font), FontSize = UiPolicy.Current.FontSize }, Tag = font };
            item.Click += (_, _) => choose(font);
            menu.Items.Add(item);
        }
        return menu;
    }
}
