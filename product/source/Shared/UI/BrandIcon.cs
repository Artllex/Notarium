using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
namespace Notarium.UI;

// One original asset, unchanged. No colored circle, crop or replacement glyph.
public sealed class BrandIcon : Image
{
    public BrandIcon()
    {
        Source = new BitmapImage(new Uri("pack://application:,,,/Notarium.UI;component/Assets/Notarium.png"));
        Stretch = Stretch.Uniform;
        System.Windows.Automation.AutomationProperties.SetName(this, "Notarium — pióro i książka");
    }
}
