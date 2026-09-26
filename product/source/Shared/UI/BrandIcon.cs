using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
namespace Notarium.UI;

// Original asset unchanged, on the shared blue circular brand background.
public sealed class BrandIcon : Grid
{
    public Image Artwork { get; }
    public BrandIcon()
    {
        Children.Add(new System.Windows.Shapes.Ellipse { Fill = UiPolicy.Current.AccentBrush });
        Artwork = new Image {
            Source = new BitmapImage(new Uri("pack://application:,,,/Notarium.UI;component/Assets/Notarium.png")),
            Stretch = Stretch.Uniform,
            Margin = new System.Windows.Thickness(4)
        };
        Children.Add(Artwork);
        System.Windows.Automation.AutomationProperties.SetName(this, "Notarium — pióro i książka");
    }
}
