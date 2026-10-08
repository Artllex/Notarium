using System.Windows.Input;
using Microsoft.Web.WebView2.Wpf;

namespace Notatnik;

/// <summary>Forward each left-button press once, including double and triple clicks.</summary>
internal sealed class NotebookWebView : WebView2CompositionControl
{
    protected override void OnMouseDoubleClick(MouseButtonEventArgs e)
    {
        // WebView2 1.0.3719.77 sends LeftButtonDoubleClick here AND sends
        // LeftButtonDown from OnMouseDown for the same second WPF press.
        // Chromium counts those as presses 2 and 3. Forward only the normal
        // down/up stream; Chromium then generates its own correct dblclick.
        // Do not mark the event handled: the normal OnMouseDown must still run.
        if (e.ChangedButton != MouseButton.Left) base.OnMouseDoubleClick(e);
    }
}
