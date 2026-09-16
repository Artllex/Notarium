using System.Windows;
using System.Windows.Documents;
using Notatnik;

class Program
{
    [STAThread]
    static int Main()
    {
        try
        {
            _ = new Application();
            var editor = new MarkdownEditor { Text = "Tekst notatki" };
            editor.AddPythonCell();
            if (editor.Document.Blocks.OfType<BlockUIContainer>().SingleOrDefault()?.Child is not CodeCellControl)
                throw new Exception("Nie utworzono wizualnej komórki kodu.");
            if (!editor.Text.Contains("<!-- cell:python -->") || !editor.Text.Contains("```python"))
                throw new Exception("Komórka nie jest serializowana.");
            editor.UndoContentChange();
            if (editor.Document.Blocks.OfType<BlockUIContainer>().Any() || editor.Text != "Tekst notatki")
                throw new Exception("Ctrl+Z nie cofnął dodania komórki.");
            Console.WriteLine("PASS: wizualna komórka, zapis i cofnięcie dodania.");
            return 0;
        }
        catch (Exception exception) { Console.Error.WriteLine(exception); return 1; }
    }
}
