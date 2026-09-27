using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
namespace Notarium.UI;

internal static class MenuBackdrop
{
    [StructLayout(LayoutKind.Sequential)]
    private struct AccentPolicy { public int State; public int Flags; public uint Color; public int Animation; }
    [StructLayout(LayoutKind.Sequential)]
    private struct CompositionData { public int Attribute; public IntPtr Data; public int Size; }
    [DllImport("user32.dll")]
    private static extern int SetWindowCompositionAttribute(IntPtr window, ref CompositionData data);

    public static void Apply(FrameworkElement surface)
    {
        if (PresentationSource.FromVisual(surface) is not HwndSource source) return;
        var policy = new AccentPolicy { State = 4, Flags = 2, Color = 0x99252525 };
        var memory = Marshal.AllocHGlobal(Marshal.SizeOf<AccentPolicy>());
        try
        {
            Marshal.StructureToPtr(policy, memory, false);
            var data = new CompositionData { Attribute = 19, Data = memory, Size = Marshal.SizeOf<AccentPolicy>() };
            SetWindowCompositionAttribute(source.Handle, ref data);
        }
        finally { Marshal.FreeHGlobal(memory); }
    }
}
