using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Threading;
using Notatnik;

class Program
{
    [STAThread]
    static int Main()
    {
        try
        {
            var app = new Application();
            var target = new Button { Content = "Popup regression check" };
            var window = new Window { Content = target, Width = 260, Height = 100, ShowInTaskbar = false };
            window.Show();
            foreach (var kind in new[] { "font", "color", "highlight", "zoom", "spacing", "cell" })
            {
                var menu = new CleanPopupMenu(target, kind == "zoom" ? 58 : null);
                var count = 0;
                object header = kind;
                if (kind == "font") header = new TextBlock { Text = "Consolas", FontFamily = new FontFamily("Consolas") };
                if (kind is "color" or "highlight")
                {
                    var panel = new StackPanel { Orientation = Orientation.Horizontal };
                    panel.Children.Add(new Border { Background = Brushes.Red, Width = 14, Height = 14 });
                    panel.Children.Add(new TextBlock { Text = "Czerwony" });
                    header = panel;
                }
                var item = new MenuItem { Header = header };
                item.Click += (_, _) => count++;
                menu.Items.Add(item);
                for (var i = 0; i < 3; i++)
                {
                    menu.IsOpen = true;
                    app.Dispatcher.Invoke(() => { }, DispatcherPriority.ApplicationIdle);
                    var field = typeof(CleanPopupMenu).GetField("_itemsHost", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
                    var host = (StackPanel)field.GetValue(menu)!;
                    var option = (Button)host.Children[0];
                    if (option.HorizontalContentAlignment != HorizontalAlignment.Stretch) throw new Exception("Popup value is not left aligned");
                    if (kind == "zoom" && option.Width != 58) throw new Exception("Zoom popup is too wide");
                    option.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
                    if (menu.IsOpen) throw new Exception("Popup did not close");
                }
                if (count != 3) throw new Exception("Selection callback failed");
                Console.WriteLine($"PASS {kind}: open, layout, select, reopen x3");
            }
            window.Close();
            return 0;
        }
        catch (Exception exception) { Console.Error.WriteLine(exception); return 1; }
    }
}
