using System.Windows;
using Microsoft.Win32;
namespace Notarium.UI;

public static class DialogService
{
    public static MessageBoxResult Show(Window? owner, string message, string title, MessageBoxButton buttons = MessageBoxButton.OK, MessageBoxImage image = MessageBoxImage.None) =>
        owner is null ? MessageBox.Show(message, title, buttons, image) : MessageBox.Show(owner, message, title, buttons, image);
    public static OpenFileDialog OpenFile(string title, string filter) => new() { Title = title, Filter = filter };
    public static SaveFileDialog SaveFile(string title, string filter, string name, string extension) => new() { Title = title, Filter = filter, FileName = name, DefaultExt = extension, AddExtension = true };
    public static string? Color(string initial)
    {
        using var picker = new System.Windows.Forms.ColorDialog { AllowFullOpen = true, FullOpen = true, AnyColor = true, SolidColorOnly = false, Color = System.Drawing.ColorTranslator.FromHtml(initial) };
        return picker.ShowDialog() == System.Windows.Forms.DialogResult.OK ? $"#{picker.Color.R:X2}{picker.Color.G:X2}{picker.Color.B:X2}" : null;
    }
}
