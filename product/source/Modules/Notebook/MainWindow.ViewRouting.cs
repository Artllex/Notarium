using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Notarium.UI;
namespace Notatnik;
public partial class MainWindow {
    private TextBox SearchBox => LibraryView.SearchBox;
    private TextBlock SearchHint => LibraryView.SearchHint;
    private ListBox NotesList => LibraryView.NotesList;
    private Grid TabsHost => TabsView.TabsHost;
    private ActionButton LeftTabsButton => TabsView.LeftTabsButton;
    private ActionButton RightTabsButton => TabsView.RightTabsButton;
    private void InitializeViewRouting() { LibraryView.Action += RouteViewAction; TabsView.Action += RouteViewAction; }
    private void RouteViewAction(string name, object sender, RoutedEventArgs e) {
        switch(name) {
            case "Tab_MouseLeftButtonDown": Tab_MouseLeftButtonDown(sender, (MouseButtonEventArgs)e); break;
            case "SidebarTitle_MouseLeftButtonDown": SidebarTitle_MouseLeftButtonDown(sender, (MouseButtonEventArgs)e); break;
            case "PreviousTabs_Click": PreviousTabs_Click(sender, (RoutedEventArgs)e); break;
            case "SidebarFavoriteButton_Click": SidebarFavoriteButton_Click(sender, (RoutedEventArgs)e); break;
            case "TabsHost_SizeChanged": TabsHost_SizeChanged(sender, (SizeChangedEventArgs)e); break;
            case "InlineTitle_LostFocus": InlineTitle_LostFocus(sender, (RoutedEventArgs)e); break;
            case "CloseTab_Click": CloseTab_Click(sender, (RoutedEventArgs)e); break;
            case "TitleBar_MouseLeftButtonDown": TitleBar_MouseLeftButtonDown(sender, (MouseButtonEventArgs)e); break;
            case "TabTitle_MouseLeftButtonDown": TabTitle_MouseLeftButtonDown(sender, (MouseButtonEventArgs)e); break;
            case "NewNote_Click": NewNote_Click(sender, (RoutedEventArgs)e); break;
            case "InlineTitle_KeyDown": InlineTitle_KeyDown(sender, (KeyEventArgs)e); break;
            case "SearchBox_TextChanged": SearchBox_TextChanged(sender, (TextChangedEventArgs)e); break;
            case "NextTabs_Click": NextTabs_Click(sender, (RoutedEventArgs)e); break;
            case "NotesList_SelectionChanged": NotesList_SelectionChanged(sender, (SelectionChangedEventArgs)e); break;
            case "DeleteNoteFromList_Click": DeleteNoteFromList_Click(sender, (RoutedEventArgs)e); break;
        }
    }
}
