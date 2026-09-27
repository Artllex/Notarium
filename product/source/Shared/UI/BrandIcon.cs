using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
namespace Notarium.UI;

// Original asset unchanged, on the shared blue rounded-square brand background.
public sealed class BrandIcon : Grid
{
    public Image Artwork { get; }
    public BrandIcon()
    {
        Children.Add(new Border
        {
            Background = UiPolicy.Current.AccentBrush,
            CornerRadius = new CornerRadius(Width > 20 ? 9 : 4)
        });
        Artwork = new Image {
            Source = new BitmapImage(new Uri("pack://application:,,,/Notarium.UI;component/Assets/Notarium.png")),
            Stretch = Stretch.Uniform,
            RenderTransformOrigin = new System.Windows.Point(0.5, 0.5),
            Margin = new System.Windows.Thickness(2),
            RenderTransform = new ScaleTransform(1.05, 1.05)
        };
        Children.Add(Artwork);
        System.Windows.Automation.AutomationProperties.SetName(this, "Notarium — pióro i książka");
    }
}
