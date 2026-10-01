using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using Notarium.UI;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        var count = 0;
        void Check(bool condition, string name)
        {
            if (!condition) throw new InvalidOperationException(name);
            Console.WriteLine("PASS " + name);
            count++;
        }

        var app = new Application();
        app.Resources.MergedDictionaries.Add(new ResourceDictionary
        {
            Source = new Uri("pack://application:,,,/Notarium.UI;component/Theme.xaml")
        });
        var window = new Window { Width = 800, Height = 600, Opacity = 0, ShowInTaskbar = false };
        var frame = new ApplicationFrame(window);
        frame.Sidebar.Content = new Border { Width = 500 }; // Wider content must not hold the column open.
        window.Content = frame;
        window.Show();
        window.UpdateLayout();

        var column = frame.ColumnDefinitions[0];
        var splitter = frame.Children.OfType<GridSplitter>().Single();
        var originalWidth = column.ActualWidth;
        Check(column.MinWidth == 0 && frame.Sidebar.ClipToBounds, "sidebar can shrink to the edge without leaking content");

        splitter.RaiseEvent(new DragStartedEventArgs(0, 0) { RoutedEvent = Thumb.DragStartedEvent });
        splitter.RaiseEvent(new DragDeltaEventArgs(45 - originalWidth, 0) { RoutedEvent = Thumb.DragDeltaEvent });
        window.UpdateLayout();
        splitter.RaiseEvent(new DragCompletedEventArgs(45 - originalWidth, 0, false) { RoutedEvent = Thumb.DragCompletedEvent });
        Check(Math.Abs(column.ActualWidth - 45) < 1 && frame.Sidebar.Visibility == Visibility.Visible,
            "sidebar remains open below the former 110-unit limit");

        splitter.RaiseEvent(new DragStartedEventArgs(0, 0) { RoutedEvent = Thumb.DragStartedEvent });
        splitter.RaiseEvent(new DragDeltaEventArgs(-45, 0) { RoutedEvent = Thumb.DragDeltaEvent });
        window.UpdateLayout();
        Check(column.ActualWidth < 0.5 && frame.Sidebar.Visibility == Visibility.Visible,
            "sidebar reaches zero without closing during the drag");
        splitter.RaiseEvent(new DragCompletedEventArgs(-45, 0, false) { RoutedEvent = Thumb.DragCompletedEvent });
        Check(frame.Sidebar.Visibility == Visibility.Collapsed && column.ActualWidth < 0.5,
            "releasing at zero closes the sidebar");

        frame.ToggleSidebar();
        window.UpdateLayout();
        Check(frame.Sidebar.Visibility == Visibility.Visible && Math.Abs(column.ActualWidth - originalWidth) < 1,
            "reopening restores the usable width from before the closing drag");

        window.Close();
        app.Shutdown();
        Console.WriteLine($"TOTAL {count} sidebar resize checks passed");
    }
}
