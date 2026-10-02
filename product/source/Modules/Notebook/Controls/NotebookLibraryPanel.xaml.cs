using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Data;
using System.Globalization;
using Notarium.UI;
namespace Notatnik;
public partial class NotebookLibraryPanel : CompositePanel {
    public NotebookLibraryPanel() => InitializeComponent();
    public event System.EventHandler? SidebarToggleRequested;
    private void SidebarIcon_Click(object sender, RoutedEventArgs e) => SidebarToggleRequested?.Invoke(this, System.EventArgs.Empty);
    private void InlineTitle_LostFocus(object sender, RoutedEventArgs e) => Emit("InlineTitle_LostFocus", sender, e);
    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e) => Emit("TitleBar_MouseLeftButtonDown", sender, e);
    private void NotesList_SelectionChanged(object sender, SelectionChangedEventArgs e) => Emit("NotesList_SelectionChanged", sender, e);
    private void SidebarFavoriteButton_Click(object sender, RoutedEventArgs e) => Emit("SidebarFavoriteButton_Click", sender, e);
    private void NewNote_Click(object sender, RoutedEventArgs e) => Emit("NewNote_Click", sender, e);
    private void InlineTitle_KeyDown(object sender, KeyEventArgs e) => Emit("InlineTitle_KeyDown", sender, e);
    private void SearchBox_TextChanged(object sender, TextChangedEventArgs e) => Emit("SearchBox_TextChanged", sender, e);
    private void SidebarTitle_MouseLeftButtonDown(object sender, MouseButtonEventArgs e) => Emit("SidebarTitle_MouseLeftButtonDown", sender, e);
    private void DeleteNoteFromList_Click(object sender, RoutedEventArgs e) => Emit("DeleteNoteFromList_Click", sender, e);
}

public sealed class FavoriteButtonVisibilityConverter : IMultiValueConverter {
    public object Convert(object[] values, System.Type targetType, object parameter, CultureInfo culture) =>
        values.Length == 2 && (values[0] is true || values[1] is true) ? Visibility.Visible : Visibility.Collapsed;

    public object[] ConvertBack(object value, System.Type[] targetTypes, object parameter, CultureInfo culture) =>
        throw new System.NotSupportedException();
}
