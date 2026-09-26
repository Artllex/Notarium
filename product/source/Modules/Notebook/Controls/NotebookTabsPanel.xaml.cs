using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Notarium.UI;
namespace Notatnik;
public partial class NotebookTabsPanel : CompositePanel {
    public NotebookTabsPanel() => InitializeComponent();
    private void CloseTab_Click(object sender, RoutedEventArgs e) => Emit("CloseTab_Click", sender, e);
    private void InlineTitle_LostFocus(object sender, RoutedEventArgs e) => Emit("InlineTitle_LostFocus", sender, e);
    private void TabsHost_SizeChanged(object sender, SizeChangedEventArgs e) => Emit("TabsHost_SizeChanged", sender, e);
    private void Tab_MouseLeftButtonDown(object sender, MouseButtonEventArgs e) => Emit("Tab_MouseLeftButtonDown", sender, e);
    private void NewNote_Click(object sender, RoutedEventArgs e) => Emit("NewNote_Click", sender, e);
    private void InlineTitle_KeyDown(object sender, KeyEventArgs e) => Emit("InlineTitle_KeyDown", sender, e);
    private void NextTabs_Click(object sender, RoutedEventArgs e) => Emit("NextTabs_Click", sender, e);
    private void TabTitle_MouseLeftButtonDown(object sender, MouseButtonEventArgs e) => Emit("TabTitle_MouseLeftButtonDown", sender, e);
    private void PreviousTabs_Click(object sender, RoutedEventArgs e) => Emit("PreviousTabs_Click", sender, e);
}
