using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Threading;
using System.Windows.Input;
using System.Diagnostics;
using Notatnik.Core;

namespace Notatnik;

public sealed partial class MarkdownEditor
{
    private string? _lastFormattedText;
    private List<(int Start, int Length, DependencyProperty Property, object Value)>? _formatOperations;
    private void QueueFormatting()
    {
        if (_formatting || _formatPending) return;
        var source = VisibleText();
        if (source == _lastFormattedText) return;
        if (!RequiresVisualFormatting(source) && !_hasVisualFormatting) return;
        _formatPending = true;
        Dispatcher.BeginInvoke(() =>
        {
            if (!_formatPending) return;
            _formatPending = false;
            FormatMarkdown();
        }, DispatcherPriority.Background);
    }

    private void FormatMarkdown()
    {
        if (_formatting) return;
        _formatting = true;
        _formatOperations = new();

        try
        {
            var selectionStart = SelectionStart;
            var selectionLength = SelectionLength;
            RenderEmoji();
            var source = VisibleText();
            _lastFormattedText = source;
            _hasVisualFormatting = RequiresVisualFormatting(source);
            var all = new TextRange(Document.ContentStart, Document.ContentEnd);
            all.ApplyPropertyValue(TextElement.FontSizeProperty, FontSize);
            all.ApplyPropertyValue(TextElement.FontFamilyProperty, FontFamily);
            all.ApplyPropertyValue(TextElement.FontWeightProperty, FontWeights.Normal);
            all.ApplyPropertyValue(TextElement.FontStyleProperty, FontStyles.Normal);
            all.ApplyPropertyValue(Inline.TextDecorationsProperty, null);
            all.ApplyPropertyValue(TextElement.BackgroundProperty, Brushes.Transparent);
            all.ApplyPropertyValue(TextElement.ForegroundProperty, Foreground);

            foreach (var paragraph in Document.Blocks.OfType<Paragraph>())
            {
                paragraph.Margin = new Thickness(0);
                paragraph.LineStackingStrategy = LineStackingStrategy.BlockLineHeight;
                paragraph.LineHeight = FontSize * _lineSpacingFactor;
            }

            foreach (Match match in Regex.Matches(source, @"(?m)^(#{1,6})[ \t]+([^\r\n]*)"))
            {
                var level = match.Groups[1].Length;
                var size = (level switch { 1 => 30d, 2 => 25d, 3 => 21d, 4 => 18d, _ => 16d }) * FontSize / 16d;
                Apply(match.Index, match.Length, TextElement.FontSizeProperty, size);
                Apply(match.Index, match.Length, TextElement.FontWeightProperty, FontWeights.SemiBold);
                Apply(match.Index, match.Groups[1].Length, TextElement.ForegroundProperty, new SolidColorBrush(Color.FromRgb(132, 139, 170)));
            }

            foreach (Match match in Regex.Matches(source, @"(?m)^[ \t]*(\d+\.|[-*+])(?=[ \t])"))
            {
                Apply(match.Index, match.Length, TextElement.ForegroundProperty, new SolidColorBrush(Color.FromRgb(143, 151, 194)));
                Apply(match.Index, match.Length, TextElement.FontWeightProperty, FontWeights.SemiBold);
            }

            ApplyMatches(source, @"\*\*(.+?)\*\*", TextElement.FontWeightProperty, FontWeights.Bold);
            ApplyMatches(source, @"(?<!_)_([^_\r\n]+)_(?!_)", TextElement.FontStyleProperty, FontStyles.Italic);
            ApplyMatches(source, @"~~(.+?)~~", Inline.TextDecorationsProperty, TextDecorations.Strikethrough);

            foreach (Match match in Regex.Matches(source, @"`([^`\r\n]+)`"))
            {
                Apply(match.Index, match.Length, TextElement.FontFamilyProperty, new FontFamily("Consolas"));
                Apply(match.Index, match.Length, TextElement.BackgroundProperty, new SolidColorBrush(Color.FromRgb(66, 71, 93)));
            }

            foreach (Match match in Regex.Matches(source, @"(?ms)^```(?:python)?\s*\r?\n.*?^```\s*$"))
            {
                Apply(match.Index, match.Length, TextElement.FontFamilyProperty, new FontFamily("Consolas"));
                Apply(match.Index, match.Length, TextElement.BackgroundProperty, new SolidColorBrush(Color.FromRgb(43, 43, 43)));
            }

            foreach (Match match in Regex.Matches(source, @"\[([^\]\r\n]+)\]\((https?://[^)\s]+|mailto:[^)\s]+)\)"))
            {
                Apply(match.Index, match.Length, TextElement.ForegroundProperty, new SolidColorBrush(Color.FromRgb(111, 166, 232)));
                Apply(match.Index, match.Length, Inline.TextDecorationsProperty, TextDecorations.Underline);
            }

            foreach (Match match in Regex.Matches(source, @"<span\s+style=""color:(#[0-9A-Fa-f]{6})"">(.*?)</span>", RegexOptions.Singleline))
            {
                var color = (Color)ColorConverter.ConvertFromString(match.Groups[1].Value);
                Apply(match.Groups[2].Index, match.Groups[2].Length, TextElement.ForegroundProperty, new SolidColorBrush(color));
                HideFormattingTag(match.Index, match.Groups[2].Index - match.Index);
                var closingStart = match.Groups[2].Index + match.Groups[2].Length;
                HideFormattingTag(closingStart, match.Index + match.Length - closingStart);
            }

            foreach (Match match in Regex.Matches(source, @"<mark\s+style=""background-color:(#[0-9A-Fa-f]{6})"">(.*?)</mark>", RegexOptions.Singleline))
            {
                var color = (Color)ColorConverter.ConvertFromString(match.Groups[1].Value);
                Apply(match.Groups[2].Index, match.Groups[2].Length, TextElement.BackgroundProperty, new SolidColorBrush(color));
                Apply(match.Groups[2].Index, match.Groups[2].Length, TextElement.ForegroundProperty, new SolidColorBrush(Color.FromRgb(35, 37, 48)));
                HideFormattingTag(match.Index, match.Groups[2].Index - match.Index);
                var closingStart = match.Groups[2].Index + match.Groups[2].Length;
                HideFormattingTag(closingStart, match.Index + match.Length - closingStart);
            }

            foreach (Match match in Regex.Matches(source, @"<span\s+style=""font-family:([^""<>]+)"">(.*?)</span>", RegexOptions.Singleline))
            {
                Apply(match.Groups[2].Index, match.Groups[2].Length, TextElement.FontFamilyProperty, new FontFamily(match.Groups[1].Value));
                HideFormattingTag(match.Index, match.Groups[2].Index - match.Index);
                var closingStart = match.Groups[2].Index + match.Groups[2].Length;
                HideFormattingTag(closingStart, match.Index + match.Length - closingStart);
            }

            // Format kodu jest nakładany na końcu, aby zawsze wygrywał
            // z ręcznie ustawioną czcionką zaznaczonego tekstu.
            foreach (Match match in Regex.Matches(source, @"`([^`\r\n]+)`"))
                Apply(match.Groups[1].Index, match.Groups[1].Length, TextElement.FontFamilyProperty, new FontFamily("Consolas"));
            foreach (Match match in Regex.Matches(source, @"(?ms)^```(?:python)?\s*\r?\n(.*?)^```\s*$"))
                Apply(match.Groups[1].Index, match.Groups[1].Length, TextElement.FontFamilyProperty, new FontFamily("Consolas"));

            HideTechnicalMarkup(source);

            var positions = new TextPositionIndex(Document,
                _formatOperations.SelectMany(operation => new[] { operation.Start, operation.Start + operation.Length }));
            foreach (var operation in _formatOperations)
                new TextRange(positions.At(operation.Start), positions.At(operation.Start + operation.Length))
                    .ApplyPropertyValue(operation.Property, operation.Value);

            foreach (var emoji in EmojiInlines())
            {
                emoji.Foreground = Brushes.Black;
                emoji.FontSize = FontSize;
            }

            Select(selectionStart, selectionLength);
        }
        finally
        {
            _formatOperations = null;
            _formatting = false;
        }
    }

    private static bool RequiresVisualFormatting(string source)
    {
        if (string.IsNullOrEmpty(source)) return false;
        return source.Any(Emoji.Wpf.EmojiData.MatchStart.Contains) || Regex.IsMatch(source,
            @"(?m)^(?:#{1,6}[ \t]+|[ \t]*(?:\d+\.|[-*+])(?=[ \t]))|\*\*|(?<!_)_[^_\r\n]+_|~~|`|\[[^\]\r\n]+\]\(|<(?:span|mark)\b|<!-- cell:");
    }

    private void ApplyMatches(string source, string pattern, DependencyProperty property, object value)
    {
        foreach (Match match in Regex.Matches(source, pattern)) Apply(match.Index, match.Length, property, value);
    }

    private void HideFormattingTag(int start, int length)
    {
        Apply(start, length, TextElement.FontSizeProperty, 0.1d);
        Apply(start, length, TextElement.ForegroundProperty, Brushes.Transparent);
        Apply(start, length, TextElement.BackgroundProperty, Brushes.Transparent);
    }

    private void HideTechnicalMarkup(string source)
    {
        // Ukrywaj również znaczniki puste, uszkodzone w trakcie kasowania
        // i pozbawione końcowego znaku >, aby implementacja formatowania
        // nigdy nie przebijała do widocznej treści dokumentu.
        foreach (Match match in Regex.Matches(source, @"(?i)</?(?:span|mark)(?:\s+style=""[^""\r\n]*"")?\s*>?|<(?:span|mark)\b[^\r\n>]*$", RegexOptions.Multiline))
        {
            HideFormattingTag(match.Index, match.Length);
        }
        foreach (Match match in Regex.Matches(source, @"(?m)^<!-- cell:(?:markdown|python) -->\s*$|^```(?:python)?\s*$"))
            HideFormattingTag(match.Index, match.Length);
    }

    private void Apply(int start, int length, DependencyProperty property, object value)
    {
        if (length <= 0) return;
        _formatOperations!.Add((start, length, property, value));
    }
}
