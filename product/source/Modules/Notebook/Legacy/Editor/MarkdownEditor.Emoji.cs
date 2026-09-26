using System.Text.RegularExpressions;
using System.Windows.Documents;
using System.Windows.Media;

namespace Notatnik;

public sealed partial class MarkdownEditor
{
    // Use the library's glyph renderer only. Its RichTextBox scans every character
    // after every formatting operation and also owns a second selection/history model.
    private void RenderEmoji()
    {
        var runs = new List<Run>();
        for (var pointer = Document.ContentStart; pointer is not null;
             pointer = pointer.GetNextContextPosition(LogicalDirection.Forward))
        {
            if (pointer.GetPointerContext(LogicalDirection.Forward) == TextPointerContext.ElementStart &&
                pointer.GetAdjacentElement(LogicalDirection.Forward) is Run run) runs.Add(run);
        }
        foreach (var run in runs)
        {
            foreach (Match match in Emoji.Wpf.EmojiData.MatchOne.Matches(run.Text).Cast<Match>().Reverse())
            {
                var start = run.ContentStart.GetPositionAtOffset(match.Index)!;
                var end = run.ContentStart.GetPositionAtOffset(match.Index + match.Length)!;
                new TextRange(start, end).Text = string.Empty;
                _ = new Emoji.Wpf.EmojiInline(start) { Text = match.Value, FontSize = FontSize, Foreground = Brushes.Black };
            }
        }
    }

    private IEnumerable<Emoji.Wpf.EmojiInline> EmojiInlines()
    {
        for (var pointer = Document.ContentStart; pointer is not null;
             pointer = pointer.GetNextContextPosition(LogicalDirection.Forward))
            if (pointer.GetPointerContext(LogicalDirection.Forward) == TextPointerContext.ElementStart &&
                pointer.GetAdjacentElement(LogicalDirection.Forward) is Emoji.Wpf.EmojiInline emoji) yield return emoji;
    }
}
