# Notarium

Minimalistyczny notatnik dla Windows: lista notatek, karty, edycja tekstu
z Tiptap/ProseMirror i komórki kodu CodeMirror 6, osadzone w WPF przez WebView2.

## Budowanie

Wymagane: Windows, .NET SDK 6, Node.js z npm, Microsoft Edge do testów
oraz WebView2 Runtime do uruchomienia aplikacji.

```powershell
./work/Notatnik/build.ps1
dotnet run --project work/WebHostCheck/WebHostCheck.csproj -c Release
```

Gotowa aplikacja trafia do `outputs/Notarium`.
Szczegóły: [architektura](work/Notatnik/ARCHITECTURE.md).
Komórki Python obsługują edycję; wykonywanie kodu nie jest jeszcze podłączone.

## Licencja

Kod projektu: [MIT](LICENSE). Zależności zachowują własne licencje;
pakiet edytora zawiera `THIRD-PARTY-NOTICES.txt`.
