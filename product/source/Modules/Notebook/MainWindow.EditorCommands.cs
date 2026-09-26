using System.Windows;
namespace Notatnik;
public partial class MainWindow {
    private void MarkdownButton_Click(object sender, RoutedEventArgs e) => _formatting.MarkdownButton_Click(sender, e);
    private void ToggleFontColor_Click(object sender, RoutedEventArgs e) => _formatting.ToggleFontColor_Click(sender, e);
    private void ToggleHighlightColor_Click(object sender, RoutedEventArgs e) => _formatting.ToggleHighlightColor_Click(sender, e);
    private void FontColorMenu_Click(object sender, RoutedEventArgs e) => _formatting.FontColorMenu_Click(sender, e);
    private void HighlightColorMenu_Click(object sender, RoutedEventArgs e) => _formatting.HighlightColorMenu_Click(sender, e);
    private void AddCodeCell_Click(object sender, RoutedEventArgs e) => _formatting.AddCodeCell_Click(sender, e);
}
