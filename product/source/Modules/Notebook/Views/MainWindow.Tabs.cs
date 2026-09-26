using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Data;
using Microsoft.Win32;
using System.IO;
using Notarium.UI;

namespace Notatnik;

// Window event adapters only; state and policies live in Services.
public partial class MainWindow
{
    private void ZoomOut_Click(object sender, RoutedEventArgs e) => ChangeZoom(-10);

    private void ZoomIn_Click(object sender, RoutedEventArgs e) => ChangeZoom(10);

    private void ZoomMenu_Click(object sender, RoutedEventArgs e)
    {
        if (sender is not Button source) return;
        var menu = CreatePopupMenu(source, itemWidth: 58);
        for (var percent = 100; percent <= 200; percent += 10)
        {
            var value = percent;
            var item = new MenuItem
            {
                Header = $"{value}%",
                IsCheckable = true,
                IsChecked = value == _zoomPercent,
            };
            item.Click += (_, _) => SetZoom(value);
            menu.Items.Add(item);
        }
        menu.IsOpen = true;
    }

    private void ChangeZoom(int change)
    {
        SetZoom(Math.Clamp(_zoomPercent + change, 20, 200));
    }

    private void SetZoom(int percent)
    {
        _zoomPercent = Math.Clamp(percent, 20, 200);
        Editor.SetZoom(_zoomPercent);
        ZoomButton.Content = $"{_zoomPercent}%";
        Editor.Focus();
    }

    private void TabTitle_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount != 2 || sender is not FrameworkElement { DataContext: OpenNote tab } title) return;
        BeginInlineRename(tab.Note, FindAncestor<ContentPresenter>(title) ?? title, inSidebar: false);
        e.Handled = true;
    }

    private void Tab_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.OriginalSource is DependencyObject source && FindAncestor<Button>(source) is not null) return;
        if (sender is not FrameworkElement { DataContext: OpenNote tab }) return;
        if (e.RightButton == MouseButtonState.Pressed)
        {
            var menu = new DropDownMenu(null);
            var favorite = new MenuItem { Header = tab.Note.IsFavorite ? "Usuń z ulubionych" : "Dodaj do ulubionych" };
            favorite.Click += (_, _) => tab.Note.IsFavorite = !tab.Note.IsFavorite;
            menu.Items.Add(favorite); menu.IsOpen = true; e.Handled = true; return;
        }
        if (e.ClickCount == 2)
        {
            BeginInlineRename(tab.Note, (DependencyObject)sender, inSidebar: false);
            e.Handled = true;
        }
        else OpenNote(tab.Note);
    }

    private void CloseTab_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is not Button { Tag: OpenNote tab }) return;
        var index = OpenNotes.IndexOf(tab);
        OpenNotes.Remove(tab);
        RefreshVisibleTabs();

        if (tab.Note != ActiveNote) return;
        if (OpenNotes.Count == 0)
        {
            ActiveNote = null;
            Editor.Clear();
        }
        else
        {
            OpenNote(OpenNotes[Math.Min(index, OpenNotes.Count - 1)].Note);
        }
    }

    private void TabsHost_SizeChanged(object sender, SizeChangedEventArgs e) => RefreshVisibleTabs();

    private void RefreshVisibleTabs(OpenNote? ensureVisible = null)
    {
        if (!IsLoaded && TabsHost.ActualWidth <= 0) return;
        _tabs.Refresh(TabsHost.ActualWidth, ensureVisible);
        OnPropertyChanged(nameof(TabWidth));
        LeftTabsButton.Visibility = _tabs.CanGoBack ? Visibility.Visible : Visibility.Collapsed;
        RightTabsButton.Visibility = _tabs.CanGoNext ? Visibility.Visible : Visibility.Collapsed;
    }

    private void PreviousTabs_Click(object sender, RoutedEventArgs e) { _tabs.Previous(); RefreshVisibleTabs(); }
    private void NextTabs_Click(object sender, RoutedEventArgs e) { _tabs.Next(); RefreshVisibleTabs(); }

}
