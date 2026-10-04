using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Animation;
namespace Notarium.UI;

// Shared reversible height animation; never hides the sidebar or its library.
public sealed class AnimatedModuleList : ContentControl
{
    private bool _expanded = true;
    public bool IsExpanded
    {
        get => _expanded;
        set { _expanded = value; BeginAnimation(HeightProperty, null); Height = value ? double.NaN : 0; }
    }
    public AnimatedModuleList() { ClipToBounds = true; VerticalAlignment = VerticalAlignment.Top; }
    public void Toggle()
    {
        var from = ActualHeight;
        _expanded = !_expanded;
        double target = 0;
        if (_expanded && Content is UIElement content)
        {
            content.Measure(new Size(Math.Max(1, ActualWidth), double.PositiveInfinity));
            target = content.DesiredSize.Height;
        }
        var animation = new DoubleAnimation(from, target, TimeSpan.FromMilliseconds(220))
        { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseInOut }, FillBehavior = FillBehavior.Stop };
        animation.Completed += (_, _) => {
            // A newer animation may already have reversed this one.
            if (_expanded == (target > 0)) { BeginAnimation(HeightProperty, null); Height = _expanded ? double.NaN : 0; }
        };
        Height = target;
        BeginAnimation(HeightProperty, animation, HandoffBehavior.SnapshotAndReplace);
    }
}
