using System.Reflection;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Notatnik;
using Notarium.UI;

internal static class RibbonVisualRegression
{
    internal static IEnumerable<T> Descendants<T>(DependencyObject parent) where T : DependencyObject
    {
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++) {
            var child = VisualTreeHelper.GetChild(parent, index);
            if (child is T match) yield return match;
            foreach (var nested in Descendants<T>(child)) yield return nested;
        }
    }
    internal static ActionButton Button(DependencyObject parent, string name) => Descendants<ActionButton>(parent).First(button => AutomationProperties.GetName(button) == name);
    internal static void Click(DependencyObject parent, string name) => Button(parent, name).RaiseEvent(new RoutedEventArgs(System.Windows.Controls.Button.ClickEvent));
    private static void SelectTab(NotebookRibbon ribbon, string name) {
        Click(ribbon, name); if (!ribbon.IsExpanded) Click(ribbon, name);
    }
    internal static DropDownMenu OpenMenu(NotebookRibbon ribbon, string name) {
        ribbon.Measure(new Size(1180, 128)); ribbon.Arrange(new Rect(0, 0, 1180, 128)); ribbon.UpdateLayout();
        Click(ribbon, name);
        return (DropDownMenu)typeof(NotebookRibbon).GetField("_openMenu", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(ribbon)!;
    }
    private static void Save(FrameworkElement element, string path, double width, double height)
    {
        element.Measure(new Size(width, height)); element.Arrange(new Rect(0, 0, width, height)); element.UpdateLayout();
        var bitmap = new RenderTargetBitmap((int)width, (int)height, 96, 96, PixelFormats.Pbgra32); bitmap.Render(element);
        var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var image = System.IO.File.Create(path); encoder.Save(image);
    }
    internal static int Run(NotebookRibbon ribbon, string fixture)
    {
        var passed = 0;
        void Check(bool okay, string name) { if (!okay) throw new InvalidOperationException(name); Console.WriteLine("PASS " + name); passed++; }
        SelectTab(ribbon, "Układ");
        var originalTool = Button(ribbon, "Marginesy");
        var expandedHeight = ribbon.DesiredSize.Height;
        Click(ribbon, "Układ"); Save(ribbon, System.IO.Path.Combine(fixture, "ribbon-collapsed.png"), 1180, 128);
        Check(!ribbon.IsExpanded && ribbon.DesiredSize.Height <= 29 && expandedHeight > ribbon.DesiredSize.Height,
            "active ribbon tab collapses all tools without leaving an empty row");
        Check(Descendants<MenuBar>(ribbon).All(menu => menu.ActualHeight == 28) && Button(ribbon, "Wstawianie").ActualHeight == 28,
            "collapsed ribbon retains shared menu and all tab buttons");
        Click(ribbon, "Układ");
        ribbon.UpdateLayout();
        Check(ribbon.IsExpanded && Button(ribbon, "Marginesy") == originalTool,
            "active ribbon tab expands the existing tools without rebuilding fields");
        var open = OpenMenu(ribbon, "Marginesy"); Click(ribbon, "Układ");
        Check(!ribbon.IsExpanded && !open.IsOpen, "collapsing ribbon also dismisses its open dropdown");
        Click(ribbon, "Wstawianie");
        ribbon.UpdateLayout();
        Check(ribbon.IsExpanded && Button(ribbon, "Tabela").Visibility == Visibility.Visible && !Descendants<ActionButton>(ribbon).Any(button => AutomationProperties.GetName(button) == "Zwiń / rozwiń wstążkę"),
            "different tab opens its tools and no standalone collapse button remains");
        foreach (var tab in new[] { "Układ", "Wstawianie", "Odwołania", "Obiekty" }) {
            SelectTab(ribbon, tab); Save(ribbon, System.IO.Path.Combine(fixture, "ribbon-" + tab + ".png"), 1180, 128);
            var large = Descendants<ActionButton>(ribbon).Where(button => Equals(button.Tag, "ribbon-large-tool")).ToArray();
            Check(large.Length >= 4 && large.All(button => Descendants<Image>(button).Any(image => image.Width == 28)), "icon ribbon has uniform large vector tools: " + tab);
        }
        SelectTab(ribbon, "Układ");
        var margins = OpenMenu(ribbon, "Marginesy");
        Check(margins.Items.OfType<MenuItem>().Count(item => item.HasItems) == 4 && margins.Items.OfType<MenuItem>().Count(item => item.IsCheckable) == 4,
            "margin menu includes four illustrated presets and four per-edge submenus");
        Save(margins.View, System.IO.Path.Combine(fixture, "menu-margins.png"), 310, 490); margins.Close();
        SelectTab(ribbon, "Wstawianie"); var table = OpenMenu(ribbon, "Tabela");
        var tableView = table.View; Save(tableView, System.IO.Path.Combine(fixture, "menu-table.png"), 310, 280);
        Check(Descendants<ActionButton>(tableView).Count(button => AutomationProperties.GetName(button).StartsWith("Tabela ")) == 80,
            "table dropdown exposes interactive 10 by 8 grid");
        Check(Descendants<ActionButton>(tableView).Where(button => AutomationProperties.GetName(button).StartsWith("Tabela ")).All(button => ((Border)button.Content).ActualWidth >= 18),
            "table grid cells render as full visible squares, not tiny dots");
        table.Close();
        SelectTab(ribbon, "Układ"); return passed;
    }
}
