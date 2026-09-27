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
        SizeChanged += (_, _) => Clip = new EllipseGeometry(new System.Windows.Rect(0, 0, ActualWidth, ActualHeight));
        Children.Add(new System.Windows.Shapes.Ellipse { Fill = UiPolicy.Current.AccentBrush });
        Artwork = new Image {
            Source = new BitmapImage(new Uri("pack://application:,,,/Notarium.UI;component/Assets/Notarium.png")),
            Stretch = Stretch.Uniform,
            RenderTransformOrigin = new System.Windows.Point(0.5, 0.5),
            RenderTransform = new ScaleTransform(1.2, 1.2)
        };
        Children.Add(Artwork);
        System.Windows.Automation.AutomationProperties.SetName(this, "Notarium — pióro i książka");
    }
}
